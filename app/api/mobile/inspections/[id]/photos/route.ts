import { AuthError, requireMobileUser } from "@/lib/auth";
import { getServerEnv } from "@/lib/env";
import { photoIdempotencyKey } from "@/lib/idempotency";
import {
  assertInspectionAccess,
  assertInspectionUnlocked,
  getInspectionOrThrow,
  getTemplateForInspection,
  InspectionAccessError,
  itemBelongsToTemplate,
} from "@/lib/inspections";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase, isPocketBaseResponseError } from "@/lib/pocketbase";
import { deviceIdFrom, logSyncEvent, requestIdFrom } from "@/lib/sync-events";
import type { InspectionPhotoRecord } from "@/lib/types";

export const runtime = "nodejs";

function textValue(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function numberValue(formData: FormData, name: string) {
  const raw = textValue(formData, name);
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

function metadataValue(formData: FormData) {
  const raw = formData.get("metadata_json");
  if (typeof raw !== "string" || !raw.trim()) return null;

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return { raw };
  }
}

function photoResponse(photo: InspectionPhotoRecord) {
  return {
    photo_id: photo.id,
    local_photo_id: photo.local_photo_id,
    inspection_id: photo.inspection,
    item_template_id: photo.item_template_id,
    photo_type: photo.photo_type,
    uploaded_at: photo.uploaded_at,
  };
}

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

      return mobileError(mobileAuthErrorStatus(error.code), {
        code: error.code,
        message: error.message,
        retryable: false,
      });
    }
    throw error;
  }

  if (!request.headers.get("content-type")?.includes("multipart/form-data")) {
    return mobileError(415, {
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Photo upload must use multipart/form-data.",
      retryable: false,
    });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return mobileError(400, {
      code: "BAD_REQUEST",
      message: "Invalid multipart body.",
      retryable: false,
    });
  }

  const localPhotoId = textValue(formData, "local_photo_id");
  const itemTemplateId = textValue(formData, "item_template_id");
  const photoType = textValue(formData, "photo_type");
  const checksum = textValue(formData, "checksum");
  const capturedAt = textValue(formData, "captured_at");
  const deviceId = deviceIdFrom(request, textValue(formData, "device_id"));
  const file = formData.get("file");
  const validationDetails = [
    !localPhotoId
      ? { field: "local_photo_id", message: "local_photo_id is required" }
      : null,
    !itemTemplateId
      ? { field: "item_template_id", message: "item_template_id is required" }
      : null,
    photoType !== "before" && photoType !== "after"
      ? { field: "photo_type", message: "photo_type must be before or after" }
      : null,
    !checksum ? { field: "checksum", message: "checksum is required" } : null,
    !capturedAt ? { field: "captured_at", message: "captured_at is required" } : null,
    !(file instanceof File)
      ? { field: "file", message: "JPEG file is required" }
      : null,
  ].filter(Boolean);

  if (validationDetails.length > 0) {
    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "photo_upload_failed",
      status: "failed",
      retryable: false,
      payload: { inspection_id: id, local_photo_id: localPhotoId },
      error: validationDetails,
    });

    return mobileError(400, {
      code: "VALIDATION_ERROR",
      message: "Photo upload payload is invalid.",
      retryable: false,
      details: validationDetails,
    });
  }

  const photoFile = file as File;
  const maxBytes = getServerEnv().MAX_INSPECTION_PHOTO_BYTES ?? 10 * 1024 * 1024;
  if (photoFile.type !== "image/jpeg") {
    return mobileError(415, {
      code: "UNSUPPORTED_MEDIA_TYPE",
      message: "Only image/jpeg uploads are supported for MVP.",
      retryable: false,
    });
  }

  if (photoFile.size > maxBytes) {
    return mobileError(413, {
      code: "PAYLOAD_TOO_LARGE",
      message: "Photo exceeds the configured maximum upload size.",
      retryable: false,
    });
  }

  try {
    const pb = await getSuperuserPocketBase();
    const inspection = await getInspectionOrThrow(pb, id);
    assertInspectionAccess(inspection, auth.user);
    assertInspectionUnlocked(inspection);

    const template = await getTemplateForInspection(pb, inspection);
    const templateItem = itemBelongsToTemplate(template, itemTemplateId);
    if (!templateItem) {
      throw new InspectionAccessError(
        "CONFLICT",
        "Photo item_template_id does not belong to this inspection template.",
      );
    }

    const idempotencyKey = photoIdempotencyKey({
      inspectionId: id,
      localPhotoId,
    });
    const filter = pb.filter("photo_idempotency_key = {:idempotencyKey}", {
      idempotencyKey,
    });

    try {
      const existing = await pb
        .collection("inspection_photos")
        .getFirstListItem<InspectionPhotoRecord>(filter);
      await logSyncEvent({
        userId: auth.user.id,
        deviceId,
        requestId,
        eventType: "photo_upload_success",
        status: "success",
        retryable: false,
        payload: {
          inspection_id: id,
          photo_id: existing.id,
          local_photo_id: localPhotoId,
          idempotent: true,
        },
      });
      return mobileSuccess(photoResponse(existing));
    } catch (error) {
      if (!isPocketBaseResponseError(error) || error.status !== 404) {
        throw error;
      }
    }

    const uploadedAt = new Date().toISOString();
    const body = new FormData();
    body.set("inspection", id);
    body.set("local_photo_id", localPhotoId);
    body.set("photo_idempotency_key", idempotencyKey);
    body.set("item_template_id", itemTemplateId);
    body.set("section_code", textValue(formData, "section_code") || templateItem.section_code);
    body.set("photo_type", photoType);
    body.set("file", photoFile);
    body.set("captured_at", capturedAt);
    body.set("uploaded_at", uploadedAt);
    body.set("checksum", checksum);

    const latitude = numberValue(formData, "latitude");
    const longitude = numberValue(formData, "longitude");
    if (latitude !== undefined) body.set("latitude", String(latitude));
    if (longitude !== undefined) body.set("longitude", String(longitude));
    body.set("metadata_json", JSON.stringify(metadataValue(formData)));

    const photo = await pb
      .collection("inspection_photos")
      .create<InspectionPhotoRecord>(body);

    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "photo_upload_success",
      status: "success",
      retryable: false,
      payload: {
        inspection_id: id,
        photo_id: photo.id,
        local_photo_id: localPhotoId,
        item_template_id: itemTemplateId,
        photo_type: photoType,
      },
    });

    return mobileSuccess(photoResponse(photo));
  } catch (error) {
    const retryable = !(error instanceof InspectionAccessError);
    await logSyncEvent({
      userId: auth.user.id,
      deviceId,
      requestId,
      eventType: "photo_upload_failed",
      status: "failed",
      retryable,
      payload: { inspection_id: id, local_photo_id: localPhotoId },
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
      message: "Unable to upload inspection photo.",
      retryable: true,
    });
  }
}
