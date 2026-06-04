import { AuthError, requireMobileUser } from "@/lib/auth";
import {
  assertInspectionAccess,
  findPdfReport,
  getInspectionOrThrow,
  InspectionAccessError,
  readyPdfReportHasFile,
} from "@/lib/inspections";
import { mobileAuthErrorStatus, mobileError } from "@/lib/mobile-response";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { pocketBaseFileUrl } from "@/lib/pdf/report-access";
import { verifyPdfDownloadToken } from "@/lib/pdf/pdf-token";
import { logSyncEvent, requestIdFrom } from "@/lib/sync-events";

export const runtime = "nodejs";

async function authorize(
  request: Request,
  inspectionId: string,
  reportId: string | null,
) {
  const token = new URL(request.url).searchParams.get("token");
  if (token) {
    let verified: ReturnType<typeof verifyPdfDownloadToken> = null;
    try {
      verified = verifyPdfDownloadToken(token);
    } catch {
      verified = null;
    }
    if (
      !verified ||
      verified.inspectionId !== inspectionId ||
      (reportId && verified.pdfReportId !== reportId)
    ) {
      return { ok: false as const, status: 401, userId: undefined };
    }
    return { ok: true as const, userId: undefined };
  }

  const auth = await requireMobileUser(request);
  return { ok: true as const, user: auth.user, userId: auth.user.id };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestId = requestIdFrom(request);
  const { id } = await params;

  try {
    const pb = await getSuperuserPocketBase();
    const inspection = await getInspectionOrThrow(pb, id);
    const report = await findPdfReport(pb, id);
    const authorization = await authorize(request, id, report?.id ?? null);

    if (!authorization.ok) {
      await logSyncEvent({
        requestId,
        eventType: "pdf_download_failed",
        status: "failed",
        retryable: false,
        payload: { inspection_id: id },
        error: { code: "UNAUTHORIZED", message: "Invalid PDF download token." },
      });
      return mobileError(authorization.status, {
        code: "UNAUTHORIZED",
        message: "Invalid or expired PDF download token.",
        retryable: false,
      });
    }

    if (authorization.user) {
      assertInspectionAccess(inspection, authorization.user);
    }

    if (!readyPdfReportHasFile(report)) {
      await logSyncEvent({
        userId: authorization.userId,
        requestId,
        eventType: "pdf_download_failed",
        status: "failed",
        retryable: false,
        payload: { inspection_id: id, pdf_report_id: report?.id ?? null },
        error: { code: "NOT_FOUND", message: "PDF is not ready." },
      });
      return mobileError(404, {
        code: "NOT_FOUND",
        message: "PDF report is not ready.",
        retryable: false,
      });
    }

    const filename = report.file ?? "";
    const fileUrl = await pocketBaseFileUrl({
      pb,
      record: report,
      filename,
    });
    const response = await fetch(fileUrl);
    if (!response.ok) {
      await logSyncEvent({
        userId: authorization.userId,
        requestId,
        eventType: "pdf_download_failed",
        status: "failed",
        retryable: true,
        payload: { inspection_id: id, pdf_report_id: report.id },
        error: { code: response.status, message: "PocketBase file fetch failed." },
      });
      return mobileError(502, {
        code: "INTERNAL_ERROR",
        message: "Unable to fetch PDF report.",
        retryable: true,
      });
    }

    await logSyncEvent({
      userId: authorization.userId,
      requestId,
      eventType: "pdf_download_requested",
      status: "success",
      retryable: false,
      payload: { inspection_id: id, pdf_report_id: report.id },
    });

    const headers: Record<string, string> = {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="klodware-inspection-${id}.pdf"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
    };
    if (report.file_size_bytes) {
      headers["Content-Length"] = String(report.file_size_bytes);
    }

    return new Response(await response.arrayBuffer(), { headers });
  } catch (error) {
    if (error instanceof AuthError) {
      await logSyncEvent({
        requestId,
        eventType: "pdf_download_failed",
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
      message: "Unable to download PDF report.",
      retryable: true,
    });
  }
}
