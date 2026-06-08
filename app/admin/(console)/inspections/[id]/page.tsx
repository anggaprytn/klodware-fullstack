import { revalidatePath } from "next/cache";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import {
  adminFindings,
  checklistRows,
  inspectionSummaryValue,
  photoUrl,
} from "@/lib/admin-inspection";
import { requireAdminSession } from "@/lib/auth";
import {
  findPdfReport,
  getInspectionOrThrow,
  getTemplateForInspection,
  inspectionPhotos,
  toMobileInspectionDetail,
} from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { canGeneratePdfDownloadToken } from "@/lib/pdf/pdf-token";
import { buildPdfDownloadUrl } from "@/lib/pdf/report-access";
import { requestPdfRegeneration } from "@/lib/pdf/report-lifecycle";
import type { PdfReportRecord, SyncEventRecord } from "@/lib/types";
import {
  InspectionDetailClient,
  type InspectionDetailView,
} from "./InspectionDetailClient";

function signedDownloadHref(report: PdfReportRecord | null) {
  if (
    !report ||
    !canGeneratePdfDownloadToken() ||
    report.status !== "ready" ||
    !report.file
  ) {
    return null;
  }

  return buildPdfDownloadUrl({
    inspectionId: report.inspection,
    pdfReportId: report.id,
  }).url;
}

async function regeneratePdfAction(formData: FormData) {
  "use server";

  const session = await requireAdminSession();
  const inspectionId = String(formData.get("inspection_id") ?? "");
  const pb = await getSuperuserPocketBase();
  const inspection = await getInspectionOrThrow(pb, inspectionId);
  await requestPdfRegeneration({
    pb,
    inspection,
    userId: session.user.id,
    deviceId: inspection.device_id,
  });
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/inspections/${inspectionId}`);
}

export default async function AdminInspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminSession();
  const { id } = await params;
  const pb = await getSuperuserPocketBase();
  const inspection = await getInspectionOrThrow(pb, id);
  const [template, photos, rawEvents, pdfReport] = await Promise.all([
    getTemplateForInspection(pb, inspection),
    inspectionPhotos(pb, inspection.id),
    pb.collection("sync_events").getList<SyncEventRecord>(1, 80, {
      filter: pb.filter("user = {:userId}", { userId: inspection.user }),
      sort: "-occurred_at",
    }),
    findPdfReport(pb, inspection.id),
  ]);
  const detail = toMobileInspectionDetail({ inspection, template, photos });
  const events = rawEvents.items.filter((event) => {
    const payload = event.payload_json as Record<string, unknown> | null;
    return (
      payload?.inspection_id === inspection.id ||
      payload?.local_id === inspection.local_id ||
      event.device_id === inspection.device_id
    );
  });
  const summary = inspectionSummaryValue(inspection);
  const downloadHref = signedDownloadHref(pdfReport);
  const view: InspectionDetailView = {
    checklist: checklistRows({ inspection, template }),
    deviceId: inspection.device_id,
    findings: adminFindings({ inspection, photos, template }),
    id: inspection.id,
    inspectorEmployeeNo: inspection.inspector_employee_no ?? "",
    inspectorName: inspection.inspector_name,
    localId: inspection.local_id,
    pdfReport: pdfReport
      ? {
          downloadHref: downloadHref ?? "",
          errorMessage: pdfReport.error_message ?? "",
          fileSizeBytes: pdfReport.file_size_bytes ?? 0,
          generatedAt: pdfReport.generated_at ?? "",
          id: pdfReport.id,
          status: pdfReport.status,
        }
      : null,
    pdfStatus: inspection.pdf_status,
    photos: photos.map((photo) => ({
      capturedAt: photo.captured_at,
      checksum: photo.checksum,
      id: photo.id,
      itemTemplateId: photo.item_template_id,
      sectionCode: photo.section_code ?? "",
      type: photo.photo_type,
      uploadedAt: photo.uploaded_at,
      url: photoUrl(photo.id),
    })),
    place: inspection.place ?? "",
    rawPayload: detail.raw_payload_json,
    startedAt: inspection.started_at ?? "",
    status: inspection.status,
    submittedAt: inspection.submitted_at ?? "",
    summary: {
      completedItems: summary?.completed_items ?? 0,
      drydockCount: summary?.drydock_count ?? 0,
      findingsCount: summary?.findings_count ?? 0,
      missingRequiredPhotoCount: summary?.missing_required_photo_count ?? 0,
      missingRequiredRemarksCount: summary?.missing_required_remarks_count ?? 0,
      missingScoreCount: summary?.missing_score_count ?? 0,
      totalItems: summary?.total_items ?? 0,
    },
    syncedAt: inspection.synced_at ?? "",
    syncEvents: events.map((event) => ({
      error: event.error_json ?? null,
      eventType: event.event_type,
      id: event.id,
      occurredAt: event.occurred_at,
      payload: event.payload_json ?? null,
      requestId: event.request_id ?? "",
      retryable: event.retryable ?? false,
      status: event.status,
    })),
    templateLabel: `${template.name} v${template.version}`,
    vessel: detail.vessel
      ? {
          id: detail.vessel.id,
          imo: detail.vessel.imo,
          name: detail.vessel.name,
          status: detail.vessel.status,
        }
      : null,
  };

  return (
    <>
      <AdminPageHeader
        title="Inspection Detail"
        description="Read-only review of synced inspection payload, evidence, and sync diagnostics."
      />
      <InspectionDetailClient regenerateAction={regeneratePdfAction} view={view} />
    </>
  );
}
