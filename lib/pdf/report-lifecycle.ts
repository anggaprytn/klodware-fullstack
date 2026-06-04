import type PocketBase from "pocketbase";
import {
  ensureQueuedPdfReport,
  InspectionAccessError,
  isSubmittedInspection,
  setInspectionPdfStatus,
} from "@/lib/inspections";
import { logSyncEvent } from "@/lib/sync-events";
import type { InspectionRecord } from "@/lib/types";

export async function requestPdfRegeneration(args: {
  pb: PocketBase;
  inspection: InspectionRecord;
  userId?: string;
  deviceId?: string;
  requestId?: string;
}) {
  if (!isSubmittedInspection(args.inspection)) {
    throw new InspectionAccessError(
      "CONFLICT",
      "PDF can only be regenerated for submitted inspections.",
    );
  }

  const [report] = await Promise.all([
    ensureQueuedPdfReport(args.pb, args.inspection.id),
    setInspectionPdfStatus(args.pb, args.inspection.id, "queued"),
  ]);

  await logSyncEvent({
    userId: args.userId,
    deviceId: args.deviceId,
    requestId: args.requestId,
    eventType: "pdf_regenerate_requested",
    status: "success",
    retryable: false,
    payload: { inspection_id: args.inspection.id, pdf_report_id: report.id },
  });

  return report;
}
