import { z } from "zod";
import { AuthError, requireMobileUser } from "@/lib/auth";
import {
  calculateInspectionSummary,
  validateInspectionForSubmit,
} from "@/lib/inspection-summary";
import {
  assertInspectionAccess,
  assertInspectionUnlocked,
  ensureQueuedPdfReport,
  getInspectionOrThrow,
  getTemplateForInspection,
  getVesselOrThrow,
  inspectionPhotos,
  InspectionAccessError,
  rawPayloadFromInspection,
} from "@/lib/inspections";
import { mobileError, mobileSuccess } from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { deviceIdFrom, logSyncEvent, requestIdFrom } from "@/lib/sync-events";

export const runtime = "nodejs";

const submitSchema = z
  .object({
    device_id: z.string().trim().min(1).optional(),
    submitted_at: z.string().trim().min(1).optional(),
  })
  .passthrough();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const { id } = await params;
  let auth: Awaited<ReturnType<typeof requireMobileUser>>;

  try {
    auth = await requireMobileUser(request);
  } catch (error) {
    if (error instanceof AuthError) {
      await logSyncEvent({
        requestId,
        eventType: "unauthorized_access",
        status: "failed",
        retryable: false,
        payload: { inspection_id: id },
        error: { code: error.code, message: error.message },
      });

      return mobileError(error.code === "FORBIDDEN" ? 403 : 401, {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }
    throw error;
  }

  let body: unknown = {};
  try {
    if (request.headers.get("content-length") !== "0") {
      body = await request.json();
    }
  } catch {
    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Invalid JSON body.",
      retryable: false,
    });
  }

  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) {
    return mobileError(400, {
      code: "VALIDATION_ERROR",
      message: "Submit payload is invalid.",
      retryable: false,
      details: parsed.error.flatten(),
    });
  }

  const deviceId = deviceIdFrom(request, parsed.data.device_id);

  try {
    const pb = await getSuperuserPocketBase();
    const inspection = await getInspectionOrThrow(pb, id);
    assertInspectionAccess(inspection, auth.user);
    assertInspectionUnlocked(inspection);

    await getVesselOrThrow(pb, inspection.vessel);
    const template = await getTemplateForInspection(pb, inspection);
    const payload = rawPayloadFromInspection(inspection);
    const photos = await inspectionPhotos(pb, id);
    const details = validateInspectionForSubmit({ payload, template, photos });

    if (details.length > 0) {
      const errorPayload = {
        code: "VALIDATION_ERROR",
        message: "Inspection is not complete",
        details,
      };
      await Promise.all([
        logSyncEvent({
          userId: auth.user.id,
          deviceId,
          requestId,
          eventType: "validation_failed",
          status: "failed",
          retryable: false,
          payload: { inspection_id: id },
          error: errorPayload,
        }),
        logSyncEvent({
          userId: auth.user.id,
          deviceId,
          requestId,
          eventType: "inspection_submit_failed",
          status: "failed",
          retryable: false,
          payload: { inspection_id: id },
          error: errorPayload,
        }),
      ]);

      return mobileError(400, {
        code: "VALIDATION_ERROR",
        message: "Inspection is not complete",
        retryable: false,
        details,
      });
    }

    const submittedAt = parsed.data.submitted_at ?? new Date().toISOString();
    const lockedAt = new Date().toISOString();
    const summary = calculateInspectionSummary(payload, template, photos);
    const updated = await pb.collection("inspections").update(id, {
      status: "submitted",
      submitted_at: submittedAt,
      locked_at: lockedAt,
      pdf_status: "queued",
      summary_json: summary,
      synced_at: lockedAt,
    });
    const report = await ensureQueuedPdfReport(pb, updated.id);

    await Promise.all([
      logSyncEvent({
        userId: auth.user.id,
        deviceId,
        requestId,
        eventType: "inspection_submit_success",
        status: "success",
        retryable: false,
        payload: {
          inspection_id: updated.id,
          pdf_report_id: report.id,
          status: "submitted",
        },
      }),
      logSyncEvent({
        userId: auth.user.id,
        deviceId,
        requestId,
        eventType: "pdf_queued",
        status: "success",
        retryable: false,
        payload: {
          inspection_id: updated.id,
          pdf_report_id: report.id,
        },
      }),
    ]);

    return mobileSuccess({
      inspection_id: updated.id,
      status: "submitted",
      locked: true,
      pdf_status: "queued",
      pdf_report_id: report.id,
    });
  } catch (error) {
    const retryable = !(error instanceof InspectionAccessError);
    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "inspection_submit_failed",
      status: "failed",
      retryable,
      payload: { inspection_id: id },
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
      message: "Unable to submit inspection.",
      retryable: true,
    });
  }
}
