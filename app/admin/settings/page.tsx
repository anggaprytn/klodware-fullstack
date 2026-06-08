import { Activity, ClipboardList, Database, FileText, Server } from "lucide-react";
import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { formatDateTime } from "@/lib/admin-format";
import { getServerEnv } from "@/lib/env";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { ChecklistTemplateRecord } from "@/lib/types";
import {
  Badge,
  PageSection,
  ShortCode,
  StatusBadge,
  SummaryCard,
} from "../components/AdminUi";

export default async function AdminSettingsPage() {
  await requireAdminSession();
  const env = getServerEnv();
  let pocketBaseStatus: "active" | "failed" = "active";
  let apiStatus: "active" | "failed" = "active";
  let activeTemplate: ChecklistTemplateRecord | null = null;

  try {
    const pb = await getSuperuserPocketBase();
    const templates = await pb
      .collection("checklist_templates")
      .getFullList<ChecklistTemplateRecord>({ sort: "-active,-version,name" });
    activeTemplate =
      templates.find((template) => template.active === true || template.is_active === true) ??
      null;
  } catch {
    pocketBaseStatus = "failed";
  }

  try {
    const healthResponse = await fetch(new URL("/api/mobile/health", env.APP_BASE_URL), {
      cache: "no-store",
    });
    apiStatus = healthResponse.ok ? "active" : "failed";
  } catch {
    apiStatus = "failed";
  }

  return (
    <AdminShell
      title="Settings"
      description="Safe runtime configuration and deployment notes for operations."
    >
      <div className="admin-grid">
        <section className="metric-grid compact">
          <SummaryCard href="/api/mobile/health" label="Mobile API" tone={apiStatus === "active" ? "success" : "danger"} value={apiStatus === "active" ? "Online" : "Check"} />
          <SummaryCard label="PocketBase" tone={pocketBaseStatus === "active" ? "success" : "danger"} value={pocketBaseStatus === "active" ? "Connected" : "Failed"} />
          <SummaryCard label="PDF Worker" tone={env.PDF_WORKER_ENABLED ? "success" : "warning"} value={env.PDF_WORKER_ENABLED ? "Enabled" : "Not enabled"} />
          <SummaryCard label="Mobile Prefix" value="/api/mobile" />
        </section>

        <PageSection title="Application">
          <dl className="detail-list settings-list">
            <div>
              <dt>App Name</dt>
              <dd>Klodware Ship Maintenance</dd>
            </div>
            <div>
              <dt>APP_BASE_URL</dt>
              <dd>{env.APP_BASE_URL}</dd>
            </div>
            <div>
              <dt>API Status</dt>
              <dd>
                <StatusBadge status={apiStatus} label={apiStatus === "active" ? "Healthy" : "Unavailable"} />
              </dd>
            </div>
            <div>
              <dt>PocketBase Connectivity</dt>
              <dd>
                <StatusBadge status={pocketBaseStatus} label={pocketBaseStatus === "active" ? "Connected" : "Unavailable"} />
              </dd>
            </div>
          </dl>
        </PageSection>

        <PageSection title="Operational Services">
          <div className="settings-grid">
            <article className="settings-card">
              <Server aria-hidden="true" />
              <div>
                <h3>Mobile REST API</h3>
                <p>Next.js route handlers remain the only supported mobile API surface.</p>
                <Badge label="/api/mobile/*" tone="info" />
              </div>
            </article>
            <article className="settings-card">
              <Database aria-hidden="true" />
              <div>
                <h3>PocketBase</h3>
                <p>PocketBase stays behind the backend facade and is not exposed to mobile clients.</p>
                <StatusBadge status={pocketBaseStatus} />
              </div>
            </article>
            <article className="settings-card">
              <FileText aria-hidden="true" />
              <div>
                <h3>PDF Worker</h3>
                <p>PDF worker behavior and queue processing are intentionally unchanged.</p>
                <StatusBadge status={env.PDF_WORKER_ENABLED ? "active" : "queued"} label={env.PDF_WORKER_ENABLED ? "Enabled" : "Deploy configured"} />
              </div>
            </article>
            <article className="settings-card">
              <Activity aria-hidden="true" />
              <div>
                <h3>Sync Diagnostics</h3>
                <p>Sync/debug event payloads are reviewed with sensitive fields redacted in admin previews.</p>
                <Badge label="Redacted preview" tone="success" />
              </div>
            </article>
          </div>
        </PageSection>

        <PageSection title="Active Template Summary">
          {activeTemplate ? (
            <dl className="detail-list settings-list">
              <div>
                <dt>Name</dt>
                <dd>{activeTemplate.name}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{activeTemplate.version}</dd>
              </div>
              <div>
                <dt>Sections / Items</dt>
                <dd>
                  {activeTemplate.sections_count ?? 0} / {activeTemplate.items_count ?? 0}
                </dd>
              </div>
              <div>
                <dt>Checksum</dt>
                <dd>
                  <ShortCode edge={8} value={activeTemplate.checksum} />
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>{formatDateTime(activeTemplate.updated)}</dd>
              </div>
            </dl>
          ) : (
            <div className="empty-state">
              <ClipboardList aria-hidden="true" className="empty-state__icon" />
              <strong>No active checklist template found.</strong>
            </div>
          )}
        </PageSection>

        <PageSection title="Deployment Notes">
          <ul className="settings-notes">
            <li>Expose only the Next.js app service publicly in Coolify.</li>
            <li>Keep PocketBase and the PDF worker internal to the compose network.</li>
            <li>Do not expose secrets, PocketBase superuser tokens, or signed PDF tokens in admin screens.</li>
            <li>Mobile inspection execution remains in the React Native app.</li>
          </ul>
        </PageSection>
      </div>
    </AdminShell>
  );
}
