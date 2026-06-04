import type PocketBase from "pocketbase";
import { getServerEnv } from "@/lib/env";
import { readyPdfReportHasFile } from "@/lib/inspections";
import type { InspectionRecord, PdfReportRecord } from "@/lib/types";
import {
  canGeneratePdfDownloadToken,
  createPdfDownloadToken,
  pdfDownloadExpiresAt,
} from "./pdf-token";

export function pdfReportIsDownloadable(report: PdfReportRecord | null) {
  return readyPdfReportHasFile(report);
}

export function buildPdfDownloadUrl(args: {
  inspectionId: string;
  pdfReportId: string;
  expiresAt?: Date;
}) {
  const env = getServerEnv();
  const url = new URL(
    `/api/mobile/inspections/${args.inspectionId}/pdf/download`,
    env.APP_BASE_URL,
  );
  let expiresAt = args.expiresAt ?? pdfDownloadExpiresAt();

  if (canGeneratePdfDownloadToken()) {
    url.searchParams.set(
      "token",
      createPdfDownloadToken({
        inspectionId: args.inspectionId,
        pdfReportId: args.pdfReportId,
        expiresAt,
      }),
    );
  } else {
    expiresAt = new Date(Date.now() + env.PDF_DOWNLOAD_TTL_MINUTES * 60 * 1000);
  }

  return {
    url: url.toString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export async function pocketBaseFileUrl(args: {
  pb: PocketBase;
  record: PdfReportRecord | InspectionRecord;
  filename: string;
}) {
  let token = "";
  try {
    token = await args.pb.files.getToken();
  } catch {
    token = "";
  }

  return args.pb.files.getURL(
    args.record,
    args.filename,
    token ? { token } : undefined,
  );
}
