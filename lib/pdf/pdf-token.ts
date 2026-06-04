import { createHmac, timingSafeEqual } from "node:crypto";
import { getServerEnv } from "@/lib/env";

type PdfTokenPayload = {
  inspection_id: string;
  pdf_report_id: string;
  exp: number;
};

export type VerifiedPdfToken = {
  inspectionId: string;
  pdfReportId: string;
  expiresAt: string;
};

function secret() {
  const value = getServerEnv().PDF_DOWNLOAD_SECRET?.trim();
  if (!value) {
    throw new Error("PDF_DOWNLOAD_SECRET is required for signed PDF URLs.");
  }
  return value;
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function sign(payloadPart: string) {
  return createHmac("sha256", secret()).update(payloadPart).digest("base64url");
}

export function canGeneratePdfDownloadToken() {
  return Boolean(getServerEnv().PDF_DOWNLOAD_SECRET?.trim());
}

export function pdfDownloadExpiresAt() {
  const minutes = getServerEnv().PDF_DOWNLOAD_TTL_MINUTES;
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function createPdfDownloadToken(args: {
  inspectionId: string;
  pdfReportId: string;
  expiresAt?: Date;
}) {
  const expiresAt = args.expiresAt ?? pdfDownloadExpiresAt();
  const payload: PdfTokenPayload = {
    inspection_id: args.inspectionId,
    pdf_report_id: args.pdfReportId,
    exp: Math.floor(expiresAt.getTime() / 1000),
  };
  const payloadPart = base64Url(JSON.stringify(payload));
  return `${payloadPart}.${sign(payloadPart)}`;
}

export function verifyPdfDownloadToken(token: string): VerifiedPdfToken | null {
  const [payloadPart, signature] = token.split(".");
  if (!payloadPart || !signature) return null;

  const expected = sign(payloadPart);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8"),
    ) as Partial<PdfTokenPayload>;
    if (
      !payload.inspection_id ||
      !payload.pdf_report_id ||
      !payload.exp ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      inspectionId: payload.inspection_id,
      pdfReportId: payload.pdf_report_id,
      expiresAt: new Date(payload.exp * 1000).toISOString(),
    };
  } catch {
    return null;
  }
}
