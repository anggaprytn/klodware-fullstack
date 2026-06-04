import { basename } from "node:path";
import { chromium } from "playwright";
import { getServerEnv } from "../lib/env";
import {
  getInspectionOrThrow,
  getTemplateForInspection,
  getVesselOrThrow,
  inspectionPhotos,
  setInspectionPdfStatus,
} from "../lib/inspections";
import { getSuperuserPocketBase } from "../lib/pocketbase";
import { renderInspectionReportHtml } from "../lib/pdf/render-inspection-report";
import { logSyncEvent } from "../lib/sync-events";
import type { InspectionRecord, PdfReportRecord } from "../lib/types";

const pollIntervalMs = 10_000;
const maxJobsPerPass = 5;

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

function sanitizeError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Unknown PDF generation error.";
  return message
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [redacted]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]")
    .slice(0, 1000);
}

async function getFileAccessToken() {
  const pb = await getSuperuserPocketBase();
  try {
    return await pb.files.getToken();
  } catch {
    return "";
  }
}

async function uploadPdfReport(args: {
  report: PdfReportRecord;
  pdfBuffer: Buffer;
  generatedAt: string;
}) {
  const pb = await getSuperuserPocketBase();
  const filename = `klodware-inspection-${args.report.inspection}-${Date.now()}.pdf`;
  const pdfBytes = new Uint8Array(args.pdfBuffer);
  const body = new FormData();
  body.set("status", "ready");
  body.set("file", new File([pdfBytes], filename, { type: "application/pdf" }));
  body.set("file_size_bytes", String(args.pdfBuffer.length));
  body.set("generated_at", args.generatedAt);
  body.set("error_message", "");
  body.set(
    "metadata_json",
    JSON.stringify({
      generated_at: args.generatedAt,
      file_name: basename(filename),
      phase: "2C",
    }),
  );

  return pb
    .collection("pdf_reports")
    .update<PdfReportRecord>(args.report.id, body);
}

async function generateReport(report: PdfReportRecord) {
  const pb = await getSuperuserPocketBase();
  const generatingAt = new Date().toISOString();
  const inspection = await getInspectionOrThrow(pb, report.inspection);
  let generatingReport = await pb
    .collection("pdf_reports")
    .update<PdfReportRecord>(report.id, {
      status: "generating",
      error_message: "",
      metadata_json: {
        generation_started_at: generatingAt,
        phase: "2C",
      },
    });

  await Promise.all([
    setInspectionPdfStatus(pb, inspection.id, "generating"),
    logSyncEvent({
      userId: inspection.user,
      deviceId: inspection.device_id,
      eventType: "pdf_generation_started",
      status: "success",
      retryable: false,
      payload: { inspection_id: inspection.id, pdf_report_id: report.id },
    }),
  ]);

  try {
    const [vessel, template, photos, fileAccessToken] = await Promise.all([
      getVesselOrThrow(pb, inspection.vessel),
      getTemplateForInspection(pb, inspection),
      inspectionPhotos(pb, inspection.id),
      getFileAccessToken(),
    ]);
    const generatedAt = new Date().toISOString();
    const html = renderInspectionReportHtml({
      pb,
      inspection,
      vessel,
      template,
      photos,
      generatedAt,
      fileAccessToken,
    });
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
      await page.setContent(html, { waitUntil: "networkidle" });
      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: {
          top: "14mm",
          right: "12mm",
          bottom: "14mm",
          left: "12mm",
        },
      });

      if (pdfBuffer.length <= 0) {
        throw new Error("Generated PDF was empty.");
      }

      generatingReport = await uploadPdfReport({
        report: generatingReport,
        pdfBuffer: Buffer.from(pdfBuffer),
        generatedAt,
      });

      if (!generatingReport.file || (generatingReport.file_size_bytes ?? 0) <= 0) {
        throw new Error("PocketBase did not persist the generated PDF file.");
      }

      await Promise.all([
        setInspectionPdfStatus(pb, inspection.id, "ready"),
        logSyncEvent({
          userId: inspection.user,
          deviceId: inspection.device_id,
          eventType: "pdf_generation_ready",
          status: "success",
          retryable: false,
          payload: {
            inspection_id: inspection.id,
            pdf_report_id: generatingReport.id,
            file_size_bytes: generatingReport.file_size_bytes,
          },
        }),
      ]);

      console.log(
        `ready ${generatingReport.id} inspection=${inspection.id} bytes=${generatingReport.file_size_bytes}`,
      );
    } finally {
      await browser.close();
    }
  } catch (error) {
    const message = sanitizeError(error);
    await Promise.all([
      pb.collection("pdf_reports").update(report.id, {
        status: "failed",
        error_message: message,
      }),
      setInspectionPdfStatus(pb, inspection.id, "failed"),
      logSyncEvent({
        userId: inspection.user,
        deviceId: inspection.device_id,
        eventType: "pdf_generation_failed",
        status: "failed",
        retryable: true,
        payload: { inspection_id: inspection.id, pdf_report_id: report.id },
        error: { message },
      }),
    ]);
    console.error(`failed ${report.id} inspection=${inspection.id}: ${message}`);
  }
}

async function pollOnce() {
  const env = getServerEnv();
  if (!env.PDF_WORKER_ENABLED) {
    console.log("PDF worker disabled by PDF_WORKER_ENABLED=false.");
    return;
  }

  const pb = await getSuperuserPocketBase();
  const staleCutoffMs = Date.now() - env.PDF_STUCK_GENERATING_MINUTES * 60 * 1000;
  const staleCutoff = new Date(staleCutoffMs).toISOString();
  const [queuedReports, generatingReports] = await Promise.all([
    pb.collection("pdf_reports").getFullList<PdfReportRecord>({
      filter: pb.filter("status = {:status}", { status: "queued" }),
      batch: maxJobsPerPass,
    }),
    pb.collection("pdf_reports").getFullList<PdfReportRecord>({
      filter: pb.filter("status = {:status}", { status: "generating" }),
      batch: maxJobsPerPass,
    }),
  ]);
  const staleReports = generatingReports.filter((report) => {
    const updatedAt = Date.parse(report.updated ?? "");
    return Number.isFinite(updatedAt) && updatedAt < staleCutoffMs;
  });
  const reports = [...queuedReports, ...staleReports];

  console.log(
    `PDF queue scan queued=${queuedReports.length} stale_generating=${staleReports.length} cutoff=${staleCutoff}`,
  );

  if (reports.length === 0) {
    console.log("No queued PDF reports.");
    return;
  }

  const orderedReports = reports.sort((a, b) => {
    const left = Date.parse(a.created ?? "");
    const right = Date.parse(b.created ?? "");
    return left - right;
  });

  for (const report of orderedReports.slice(0, maxJobsPerPass)) {
    await generateReport(report);
  }
}

async function main() {
  const watch = hasFlag("watch");

  do {
    await pollOnce();
    if (watch) {
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  } while (watch);
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exit(1);
});
