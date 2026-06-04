import { AuthError, requireMobileUser } from "@/lib/auth";
import {
  assertInspectionAccess,
  findPdfReport,
  getInspectionOrThrow,
  InspectionAccessError,
  readyPdfReportHasFile,
  setInspectionPdfStatus,
} from "@/lib/inspections";
import {
  mobileAuthErrorStatus,
  mobileError,
  mobileSuccess,
} from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { buildPdfDownloadUrl } from "@/lib/pdf/report-access";
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

    const report = await findPdfReport(pb, id);
    if (report?.status === "ready" && !readyPdfReportHasFile(report)) {
      await Promise.all([
        pb.collection("pdf_reports").update(report.id, {
          status: "failed",
          error_message: "Ready PDF report is missing a generated file.",
        }),
        setInspectionPdfStatus(pb, id, "failed"),
      ]);
      return mobileSuccess({
        inspection_id: id,
        pdf_status: "failed",
        pdf_report_id: report.id,
        file_size_bytes: 0,
        generated_at: null,
        pdf_url: null,
        expires_at: null,
      });
    }

    if (!readyPdfReportHasFile(report)) {
      return mobileSuccess({
        inspection_id: id,
        pdf_status: report?.status ?? inspection.pdf_status,
        pdf_report_id: report?.id ?? null,
        file_size_bytes: report?.file_size_bytes ?? 0,
        generated_at: report?.generated_at ?? null,
        pdf_url: null,
        expires_at: null,
      });
    }

    const download = buildPdfDownloadUrl({
      inspectionId: id,
      pdfReportId: report.id,
    });

    return mobileSuccess({
      inspection_id: id,
      pdf_status: "ready",
      pdf_report_id: report.id,
      file_size_bytes: report.file_size_bytes ?? 0,
      generated_at: report.generated_at ?? null,
      pdf_url: download.url,
      expires_at: download.expiresAt,
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
      message: "Unable to load PDF status.",
      retryable: true,
    });
  }
}
