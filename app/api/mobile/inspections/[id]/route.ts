import { AuthError, requireMobileUser } from "@/lib/auth";
import {
  assertInspectionAccess,
  getInspectionOrThrow,
  getTemplateForInspection,
  inspectionPhotos,
  InspectionAccessError,
  toMobileInspectionDetail,
} from "@/lib/inspections";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { logSyncEvent, requestIdFrom } from "@/lib/sync-events";

export const runtime = "nodejs";

export async function GET(
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

  try {
    const pb = await getSuperuserPocketBase();
    const inspection = await getInspectionOrThrow(pb, id);
    assertInspectionAccess(inspection, auth.user);
    const [template, photos] = await Promise.all([
      getTemplateForInspection(pb, inspection),
      inspectionPhotos(pb, inspection.id),
    ]);

    return mobileSuccess(
      toMobileInspectionDetail({
        inspection,
        template,
        photos,
      }),
    );
  } catch (error) {
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
      message: "Unable to load inspection.",
      retryable: true,
    });
  }
}
