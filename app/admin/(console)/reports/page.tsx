import { revalidatePath } from "next/cache";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminSession } from "@/lib/auth";
import { getInspectionOrThrow, isSubmittedInspection } from "@/lib/inspections";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { canGeneratePdfDownloadToken } from "@/lib/pdf/pdf-token";
import { buildPdfDownloadUrl } from "@/lib/pdf/report-access";
import { requestPdfRegeneration } from "@/lib/pdf/report-lifecycle";
import type {
  InspectionRecord,
  PdfReportRecord,
  UserRecord,
  VesselRecord,
} from "@/lib/types";
import { AdminReportsClient, type AdminReportRow } from "./ReportsClient";

function inspectionFromExpand(report: PdfReportRecord) {
  const expanded = report.expand as Record<string, unknown> | undefined;
  return expanded?.inspection as InspectionRecord | undefined;
}

function vesselFromExpand(inspection?: InspectionRecord) {
  const expanded = inspection?.expand as Record<string, unknown> | undefined;
  return expanded?.vessel as VesselRecord | undefined;
}

function userFromExpand(inspection?: InspectionRecord) {
  const expanded = inspection?.expand as Record<string, unknown> | undefined;
  return expanded?.user as UserRecord | undefined;
}

function signedDownloadHref(report: PdfReportRecord) {
  if (!canGeneratePdfDownloadToken() || report.status !== "ready" || !report.file) {
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

export default async function AdminReportsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const [reports, inspections] = await Promise.all([
    pb.collection("pdf_reports").getFullList<PdfReportRecord>({
      expand: "inspection,inspection.vessel,inspection.user",
      sort: "-generated_at",
    }),
    pb.collection("inspections").getFullList<InspectionRecord>({
      expand: "vessel,user",
      sort: "-submitted_at,-synced_at",
    }),
  ]);
  const reportInspectionIds = new Set(reports.map((report) => report.inspection));
  const reportRows: AdminReportRow[] = reports.map((report) => {
    const inspection = inspectionFromExpand(report);
    const vessel = vesselFromExpand(inspection);
    const user = userFromExpand(inspection);

    return {
      downloadHref: signedDownloadHref(report) ?? "",
      errorMessage: report.error_message ?? "",
      fileSizeBytes: report.file_size_bytes ?? 0,
      generatedAt: report.generated_at ?? "",
      inspectionId: inspection?.id ?? report.inspection,
      inspectionLocalId: inspection?.local_id ?? "",
      inspectorName: inspection?.inspector_name || user?.full_name || "",
      metadata: report.metadata_json ?? null,
      reportId: report.id,
      rowId: `report:${report.id}`,
      status: report.status,
      submittedAt: inspection?.submitted_at ?? "",
      vesselName: vessel?.name ?? "",
    };
  });
  const pendingRows: AdminReportRow[] = inspections
    .filter(
      (inspection) =>
        isSubmittedInspection(inspection) && !reportInspectionIds.has(inspection.id),
    )
    .map((inspection) => {
      const expanded = inspection.expand as Record<string, unknown> | undefined;
      const vessel = expanded?.vessel as VesselRecord | undefined;
      const user = expanded?.user as UserRecord | undefined;

      return {
        downloadHref: "",
        errorMessage: "",
        fileSizeBytes: 0,
        generatedAt: "",
        inspectionId: inspection.id,
        inspectionLocalId: inspection.local_id,
        inspectorName: inspection.inspector_name || user?.full_name || "",
        metadata: null,
        reportId: "",
        rowId: `pending:${inspection.id}`,
        status: inspection.pdf_status === "not_requested" ? "not_requested" : inspection.pdf_status,
        submittedAt: inspection.submitted_at ?? "",
        vesselName: vessel?.name ?? "",
      };
    });

  return (
    <>
      <AdminPageHeader
        title="Reports"
        description="Manage generated inspection PDF reports."
      />
      <AdminReportsClient
        regenerateAction={regeneratePdfAction}
        rows={[...reportRows, ...pendingRows]}
        totalReportRecords={reports.length}
      />
    </>
  );
}
