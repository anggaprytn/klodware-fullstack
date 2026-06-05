import Link from "next/link";
import { AdminShell } from "../AdminShell";
import { getAdminStats, requireAdminSession } from "@/lib/auth";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import { formatDateTime, hasPocketBaseFile, humanizeStatus } from "@/lib/admin-format";
import {
  Badge,
  EmptyState,
  PageSection,
  SummaryCard,
} from "../components/AdminUi";
import type {
  ChecklistTemplateRecord,
  InspectionRecord,
  PdfReportRecord,
  SyncEventRecord,
  UserRecord,
  VesselRecord,
} from "@/lib/types";

type Activity = {
  label: string;
  meta: string;
  at: string;
  href: string;
};

function recordTime(record: object) {
  const timestamped = record as { updated?: unknown; created?: unknown };
  if (typeof timestamped.updated === "string") return timestamped.updated;
  if (typeof timestamped.created === "string") return timestamped.created;
  return "";
}

function latestActivities(args: {
  vessels: VesselRecord[];
  templates: ChecklistTemplateRecord[];
  inspections: InspectionRecord[];
  reports: PdfReportRecord[];
  users: UserRecord[];
  syncEvents: SyncEventRecord[];
}) {
  const activities: Activity[] = [
    ...args.inspections
      .filter((inspection) => inspection.submitted_at)
      .map((inspection) => ({
        label: "Inspection submitted",
        meta: inspection.inspector_name || inspection.id,
        at: inspection.submitted_at ?? "",
        href: `/admin/inspections/${inspection.id}`,
      })),
    ...args.reports
      .filter((report) => report.generated_at || report.status === "failed")
      .map((report) => ({
        label:
          report.status === "failed"
            ? "PDF generation failed"
            : "PDF generated",
        meta: report.error_message || report.inspection,
        at: report.generated_at ?? recordTime(report),
        href: "/admin/reports",
      })),
    ...args.vessels.map((vessel) => ({
      label: "Vessel record updated",
      meta: vessel.name,
      at: recordTime(vessel),
      href: "/admin/vessels",
    })),
    ...args.templates.map((template) => ({
      label: "Template record updated",
      meta: `${template.name} v${template.version}`,
      at: recordTime(template),
      href: "/admin/templates",
    })),
    ...args.users.map((user) => ({
      label: "User record updated",
      meta: user.full_name || user.username,
      at: recordTime(user),
      href: "/admin/users",
    })),
    ...args.syncEvents.map((event) => ({
      label: `Sync ${humanizeStatus(event.status)}`,
      meta: humanizeStatus(event.event_type),
      at: event.occurred_at,
      href: "/admin/inspections",
    })),
  ].filter((activity) => activity.at);

  return activities
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, 8);
}

export default async function AdminDashboardPage() {
  const session = await requireAdminSession();
  const stats = await getAdminStats(session.pb);
  const pb = await getSuperuserPocketBase();
  const [vessels, templates, inspections, reports, users, syncEvents] =
    await Promise.all([
      pb.collection("vessels").getFullList<VesselRecord>({ sort: "-updated" }),
      pb
        .collection("checklist_templates")
        .getFullList<ChecklistTemplateRecord>({ sort: "-active,-updated" }),
      pb.collection("inspections").getFullList<InspectionRecord>({
        sort: "-synced_at,-updated",
      }),
      pb.collection("pdf_reports").getFullList<PdfReportRecord>({
        sort: "-generated_at,-updated",
      }),
      pb.collection("users").getFullList<UserRecord>({ sort: "-updated" }),
      pb.collection("sync_events").getList<SyncEventRecord>(1, 20, {
        sort: "-occurred_at",
      }),
    ]);

  const activeVessels = vessels.filter((vessel) => vessel.status === "active");
  const inactiveVessels = vessels.filter((vessel) => vessel.status === "inactive");
  const submittedInspections = inspections.filter(
    (inspection) =>
      inspection.status === "submitted" || inspection.status === "locked",
  );
  const inspectionsWithoutSyncTime = inspections.filter(
    (inspection) => !inspection.synced_at,
  );
  const pdfReadyReports = reports.filter((report) => report.status === "ready");
  const pdfFailedReports = reports.filter((report) => report.status === "failed");
  const reportsGenerating = reports.filter(
    (report) => report.status === "queued" || report.status === "generating",
  );
  const activeTemplate = templates.find(
    (template) => template.active === true || template.is_active === true,
  );
  const invalidTemplates = templates.filter(
    (template) => (template.sections_count ?? 0) < 29 || (template.items_count ?? 0) < 150,
  );
  const syncFailures = syncEvents.items.filter((event) => event.status === "failed");
  const missingImageVessels = vessels.filter(
    (vessel) => !hasPocketBaseFile(vessel.image),
  );
  const inactiveVesselIds = new Set(inactiveVessels.map((vessel) => vessel.id));
  const inactiveVesselsWithInspectionData = new Set(
    inspections
      .filter((inspection) => inactiveVesselIds.has(inspection.vessel))
      .map((inspection) => inspection.vessel),
  );
  const activities = latestActivities({
    inspections,
    reports,
    syncEvents: syncEvents.items,
    templates,
    users,
    vessels,
  });
  const hasOperationalData =
    stats.vessels + stats.templates + stats.inspections + stats.reports + stats.users > 0;
  const attentionItems = [
    {
      label: "Failed PDF generation",
      count: pdfFailedReports.length,
      href: "/admin/reports",
      tone: "danger" as const,
    },
    {
      label: "Sync failures",
      count: syncFailures.length,
      href: "/admin/inspections",
      tone: "danger" as const,
    },
    {
      label: "Missing vessel images",
      count: missingImageVessels.length,
      href: "/admin/vessels",
      tone: "warning" as const,
    },
    {
      label: "Invalid templates",
      count: invalidTemplates.length,
      href: "/admin/templates",
      tone: "danger" as const,
    },
    {
      label: "Inactive vessels with inspection data",
      count: inactiveVesselsWithInspectionData.size,
      href: "/admin/vessels",
      tone: "warning" as const,
    },
    {
      label: "Reports waiting generation",
      count: reportsGenerating.length,
      href: "/admin/reports",
      tone: "warning" as const,
    },
  ];

  return (
    <AdminShell
      title="Dashboard"
      description="Operational overview for vessel inspections."
    >
      <div className="admin-grid">
        <section className="metric-grid">
          <SummaryCard href="/admin/vessels" label="Vessels" value={stats.vessels} />
          <SummaryCard href="/admin/templates" label="Templates" value={stats.templates} />
          <SummaryCard href="/admin/inspections" label="Inspections" value={stats.inspections} />
          <SummaryCard href="/admin/reports" label="Reports" value={stats.reports} />
          <SummaryCard href="/admin/users" label="Users" value={stats.users} />
        </section>

        {!hasOperationalData ? (
          <EmptyState
            action={
              <>
                <Link className="button" href="/admin/vessels">
                  Create Vessel
                </Link>
                <Link className="button secondary" href="/admin/templates">
                  Import Template
                </Link>
              </>
            }
            title="No operational data yet. Create a vessel and import a template to begin."
          />
        ) : null}

        <PageSection title="Operational Health">
          <section className="metric-grid compact">
            <SummaryCard label="Active Vessels" tone="success" value={activeVessels.length} />
            <SummaryCard label="Inactive Vessels" value={inactiveVessels.length} />
            <SummaryCard label="Submitted Inspections" tone="success" value={submittedInspections.length} />
            <SummaryCard
              label="Missing Sync Time"
              meta="Server records without synced_at"
              tone={inspectionsWithoutSyncTime.length > 0 ? "warning" : "success"}
              value={inspectionsWithoutSyncTime.length}
            />
            <SummaryCard label="PDF Ready" tone="success" value={pdfReadyReports.length} />
            <SummaryCard label="PDF Failed" tone={pdfFailedReports.length > 0 ? "danger" : "success"} value={pdfFailedReports.length} />
            <SummaryCard label="Reports Generating" tone={reportsGenerating.length > 0 ? "warning" : "success"} value={reportsGenerating.length} />
            <SummaryCard
              label="Active Template Status"
              meta={activeTemplate ? `${activeTemplate.name} v${activeTemplate.version}` : "No active template"}
              tone={activeTemplate ? "success" : "danger"}
              value={activeTemplate ? "Active" : "Missing"}
            />
          </section>
        </PageSection>

        <PageSection title="Needs Attention">
          {attentionItems.some((item) => item.count > 0) ? (
            <div className="admin-list">
              {attentionItems
                .filter((item) => item.count > 0)
                .map((item) => (
                  <Link className="attention-row" href={item.href} key={item.label}>
                    <div>
                      <strong>{item.label}</strong>
                      <p className="muted">Review available server records.</p>
                    </div>
                    <Badge label={String(item.count)} tone={item.tone} />
                  </Link>
                ))}
            </div>
          ) : (
            <EmptyState title="No operational issues found in available records." />
          )}
        </PageSection>

        <PageSection title="Recent Activity">
          {activities.length > 0 ? (
            <div className="admin-list">
              {activities.map((activity) => (
                <Link
                  className="activity-row"
                  href={activity.href}
                  key={`${activity.label}-${activity.at}-${activity.meta}`}
                >
                  <div>
                    <strong>{activity.label}</strong>
                    <p className="muted">{activity.meta}</p>
                  </div>
                  <span className="muted">{formatDateTime(activity.at)}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState title="No recent activity from available records." />
          )}
        </PageSection>
      </div>
    </AdminShell>
  );
}
