import { AuthError, requireMobileUser } from "@/lib/auth";
import {
  assertInspectionAccess,
  getInspectionOrThrow,
  InspectionAccessError,
} from "@/lib/inspections";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { requestPdfRegeneration } from "@/lib/pdf/report-lifecycle";
import { deviceIdFrom, logSyncEvent, requestIdFrom } from "@/lib/sync-events";

export const runtime = "nodejs";

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

  try {
    const pb = await getSuperuserPocketBase();
    const inspection = await getInspectionOrThrow(pb, id);
    assertInspectionAccess(inspection, auth.user);

    const report = await requestPdfRegeneration({
      pb,
      inspection,
      userId: auth.user.id,
      deviceId: deviceIdFrom(request, inspection.device_id),
      requestId,
    });

    return mobileSuccess({
      inspection_id: id,
      pdf_status: "queued",
      pdf_report_id: report.id,
    });
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
      message: "Unable to regenerate PDF report.",
      retryable: true,
    });
  }
}
