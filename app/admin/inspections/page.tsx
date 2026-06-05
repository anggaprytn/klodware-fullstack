import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { inspectionSummaryValue } from "@/lib/admin-inspection";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { InspectionRecord, UserRecord, VesselRecord } from "@/lib/types";
import { AdminInspectionsClient } from "./InspectionsClient";

function vesselFromExpand(inspection: InspectionRecord) {
  const expanded = inspection.expand as Record<string, unknown> | undefined;
  return expanded?.vessel as VesselRecord | undefined;
}

function userFromExpand(inspection: InspectionRecord) {
  const expanded = inspection.expand as Record<string, unknown> | undefined;
  return expanded?.user as UserRecord | undefined;
}

export default async function AdminInspectionsPage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();

  const inspections = await pb.collection("inspections").getFullList<InspectionRecord>({
    expand: "vessel,user",
    sort: "-submitted_at,-synced_at",
  });
  const rows = inspections.map((inspection) => {
    const summary = inspectionSummaryValue(inspection);
    const vessel = vesselFromExpand(inspection);
    const user = userFromExpand(inspection);

    return {
      completedItems: summary?.completed_items ?? 0,
      drydockCount: summary?.drydock_count ?? 0,
      findingsCount: summary?.findings_count ?? 0,
      id: inspection.id,
      imo: vessel?.imo ?? vessel?.imo_no ?? "",
      inspectorName: inspection.inspector_name || user?.full_name || "",
      localId: inspection.local_id,
      mmsi: vessel?.mmsi ?? "",
      pdfStatus: inspection.pdf_status,
      status: inspection.status,
      submittedAt: inspection.submitted_at ?? "",
      syncedAt: inspection.synced_at ?? "",
      totalItems: summary?.total_items ?? 0,
      vesselId: inspection.vessel,
      vesselName: vessel?.name ?? inspection.vessel,
    };
  });

  return (
    <AdminShell
      title="Inspections"
      description="Review submitted mobile inspections and evidence."
    >
      <AdminInspectionsClient rows={rows} />
    </AdminShell>
  );
}
