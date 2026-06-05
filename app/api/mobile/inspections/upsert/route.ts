import { AuthError, requireMobileUser } from "@/lib/auth";
import { inspectionIdempotencyKey } from "@/lib/idempotency";
import {
  calculateInspectionSummary,
  inspectionUpsertSchema,
  validateItemIdsBelongToTemplate,
} from "@/lib/inspection-summary";
import {
  assertInspectionUnlocked,
  getTemplateForPayload,
  getVesselOrThrow,
  InspectionAccessError,
} from "@/lib/inspections";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import { deviceIdFrom, logSyncEvent, requestIdFrom } from "@/lib/sync-events";
import type { InspectionRecord } from "@/lib/types";
import { assertCanInspectVessel } from "@/lib/vessel-privileges";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = requestIdFrom(request);
  let auth: Awaited<ReturnType<typeof requireMobileUser>>;
  let payload: unknown;

  try {
    auth = await requireMobileUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      await logSyncEvent({
        requestId,
        eventType: "unauthorized_access",
        status: "failed",
        retryable: false,
        error: { code: error.code, message: error.message },
      });

      return mobileError(mobileAuthErrorStatus(error.code), {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }
    throw error;
  }

  try {
    payload = await request.json();
  } catch {
    await logSyncEvent({
      userId: auth.user.id,
      requestId,
      eventType: "inspection_upsert_failed",
      status: "failed",
      retryable: false,
      error: { code: "BAD_REQUEST", message: "Invalid JSON body." },
    });

    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Invalid JSON body.",
      retryable: false,
    });
  }

  const parsed = inspectionUpsertSchema.safeParse(payload);
  if (!parsed.success) {
    await logSyncEvent({
      userId: auth.user.id,
      requestId,
      eventType: "inspection_upsert_failed",
      status: "failed",
      retryable: false,
      payload,
      error: parsed.error.flatten(),
    });

    return mobileError(400, {
      code: "VALIDATION_ERROR",
      message: "Inspection payload is invalid.",
      retryable: false,
      details: parsed.error.flatten(),
    });
  }

  const input = parsed.data;
  const deviceId = deviceIdFrom(request, input.device_id);

  try {
    const pb = await getSuperuserPocketBase();
    const [vessel, template] = await Promise.all([
      getVesselOrThrow(pb, input.vessel_id),
      getTemplateForPayload(pb, input),
    ]);
    assertCanInspectVessel(auth.user, vessel);

    const itemErrors = validateItemIdsBelongToTemplate(input, template);

    if (itemErrors.length > 0) {
      await logSyncEvent({
        userId: auth.user.id,
        deviceId,
        requestId,
        eventType: "validation_failed",
        status: "failed",
        retryable: false,
        payload: {
          local_id: input.local_id,
          vessel_id: input.vessel_id,
          template_id: input.template_id,
        },
        error: itemErrors,
      });

      return mobileError(400, {
        code: "VALIDATION_ERROR",
        message: "Inspection payload contains unknown checklist items.",
        retryable: false,
        details: itemErrors,
      });
    }

    const idempotencyKey = inspectionIdempotencyKey({
      userId: auth.user.id,
      deviceId: input.device_id,
      localId: input.local_id,
    });
    const syncedAt = new Date().toISOString();
    const summary = calculateInspectionSummary(input, template);
    const body = {
      local_id: input.local_id,
      user: auth.user.id,
      device_id: input.device_id,
      idempotency_key: idempotencyKey,
      vessel: vessel.id,
      template_id: template.template_id,
      template_version: template.version,
      template_checksum: template.checksum,
      inspector_name: auth.user.full_name,
      inspector_employee_no: auth.user.employee_no ?? "",
      place: input.place ?? "",
      status: "draft",
      pdf_status: "not_requested",
      started_at: input.started_at || undefined,
      synced_at: syncedAt,
      summary_json: summary,
      raw_payload_json: {
        ...input,
        inspector_name: undefined,
        inspector_employee_no: undefined,
      },
    };

    let inspection: InspectionRecord;
    const filter = pb.filter("idempotency_key = {:idempotencyKey}", {
      idempotencyKey,
    });

    try {
      const existing = await pb
        .collection("inspections")
        .getFirstListItem<InspectionRecord>(filter);
      assertInspectionUnlocked(existing);
      inspection = await pb
        .collection("inspections")
        .update<InspectionRecord>(existing.id, body);
    } catch (error) {
      if (error instanceof InspectionAccessError) {
        throw error;
      }

      if (!isPocketBaseResponseError(error) || error.status !== 404) {
        throw error;
      }

      inspection = await pb.collection("inspections").create<InspectionRecord>(body);
    }

    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "inspection_upsert_success",
      status: "success",
      retryable: false,
      payload: {
        inspection_id: inspection.id,
        local_id: inspection.local_id,
        status: inspection.status,
        item_count: input.items.length,
      },
    });

    return mobileSuccess({
      inspection_id: inspection.id,
      local_id: inspection.local_id,
      status: inspection.status,
      pdf_status: inspection.pdf_status,
      synced_at: inspection.synced_at ?? syncedAt,
    });
  } catch (error) {
    const retryable = !(error instanceof InspectionAccessError);
    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "inspection_upsert_failed",
      status: "failed",
      retryable,
      payload: {
        local_id: input.local_id,
        vessel_id: input.vessel_id,
        template_id: input.template_id,
      },
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : { message: "Unknown error" },
    });

    if (error instanceof InspectionAccessError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "FORBIDDEN" ? 403 : 409;
      return mobileError(status, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }

    return mobileError(500, {
      code: "INTERNAL_ERROR",
      message: "Unable to upsert inspection.",
      retryable: true,
    });
  }
}
