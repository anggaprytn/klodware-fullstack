"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDateTime, formatFileSize, safeJsonPreview } from "@/lib/admin-format";
import type { AdminFinding } from "@/lib/admin-inspection";
import type { InspectionStatus, PdfStatus } from "@/lib/types";
import {
  EmptyState,
  PageSection,
  PdfStatusBadge,
  ShortCode,
  StatusBadge,
  SummaryCard,
} from "../../../components/AdminUi";
import { CopyButton } from "../../../components/CopyButton";
import { ActionForm, type AdminAction } from "../../../components/ActionForm";

type DetailTab = "overview" | "findings" | "photos" | "checklist" | "debug";
type RegenerateAction = AdminAction;

type DetailPhoto = {
  id: string;
  itemTemplateId: string;
  sectionCode: string;
  type: "before" | "after";
  checksum: string;
  capturedAt: string;
  uploadedAt: string;
  url: string;
};

type ChecklistSection = {
  code: string;
  name: string;
  items: Array<{
    id: string;
    label: string;
    score: string;
    remarks: string;
  }>;
};

type SyncEvent = {
  id: string;
  occurredAt: string;
  eventType: string;
  status: "success" | "failed";
  retryable: boolean;
  requestId: string;
  payload: unknown;
  error: unknown;
};

type PdfReportDetail = {
  id: string;
  status: Exclude<PdfStatus, "not_requested">;
  fileSizeBytes: number;
  generatedAt: string;
  errorMessage: string;
  downloadHref: string;
};

export type InspectionDetailView = {
  id: string;
  localId: string;
  deviceId: string;
  vessel: {
    id: string;
    name: string;
    imo: string;
    status: string;
  } | null;
  inspectorName: string;
  inspectorEmployeeNo: string;
  place: string;
  status: InspectionStatus;
  pdfStatus: PdfStatus;
  startedAt: string;
  submittedAt: string;
  syncedAt: string;
  templateLabel: string;
  summary: {
    totalItems: number;
    completedItems: number;
    findingsCount: number;
    drydockCount: number;
    missingScoreCount: number;
    missingRequiredRemarksCount: number;
    missingRequiredPhotoCount: number;
  };
  pdfReport: PdfReportDetail | null;
  findings: AdminFinding[];
  photos: DetailPhoto[];
  checklist: ChecklistSection[];
  syncEvents: SyncEvent[];
  rawPayload: unknown;
};

function SubmitPdfButton({ label, pending }: { label: string; pending: boolean }) {
  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Requesting..." : label}
    </button>
  );
}

function pdfActionLabel(view: InspectionDetailView) {
  const reportStatus = view.pdfReport?.status;
  if (view.pdfStatus === "failed" || reportStatus === "failed") return "Retry Generate";
  if (view.pdfStatus === "ready" || reportStatus === "ready") return "Regenerate PDF";
  if (view.pdfStatus === "not_requested") return "Generate PDF";
  return "Regenerate PDF";
}

function PhotoPreview({
  onClose,
  photo,
}: {
  onClose: () => void;
  photo: DetailPhoto;
}) {
  return (
    <>
      <button
        aria-label="Close photo preview"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside className="photo-preview" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <h2>{photo.type === "before" ? "Before Photo" : "After Photo"}</h2>
            <p className="muted">{photo.itemTemplateId}</p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        {/* The image is served by an internal admin-only proxy. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${photo.itemTemplateId} ${photo.type}`} src={photo.url} />
      </aside>
    </>
  );
}

function PhotoGrid({
  photos,
  title,
}: {
  photos: DetailPhoto[];
  title: string;
}) {
  const [preview, setPreview] = useState<DetailPhoto | null>(null);

  return (
    <div className="admin-grid">
      <h3>{title}</h3>
      {photos.length > 0 ? (
        <div className="photo-grid">
          {photos.map((photo) => (
            <button
              className="photo-card"
              key={photo.id}
              onClick={() => setPreview(photo)}
              type="button"
            >
              {/* The image is served by an internal admin-only proxy. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`${photo.itemTemplateId} ${photo.type}`} src={photo.url} />
              <span>{photo.itemTemplateId}</span>
              <small>{formatDateTime(photo.capturedAt)}</small>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title={`No ${title.toLowerCase()} uploaded.`} />
      )}
      {preview ? <PhotoPreview onClose={() => setPreview(null)} photo={preview} /> : null}
    </div>
  );
}

export function InspectionDetailClient({
  regenerateAction,
  view,
}: {
  regenerateAction: RegenerateAction;
  view: InspectionDetailView;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");
  const beforePhotos = view.photos.filter((photo) => photo.type === "before");
  const afterPhotos = view.photos.filter((photo) => photo.type === "after");
  const openValidationCount =
    view.summary.missingScoreCount +
    view.summary.missingRequiredRemarksCount +
    view.summary.missingRequiredPhotoCount;
  const diagnosticsText = safeJsonPreview(
    {
      inspection_id: view.id,
      local_id: view.localId,
      device_id: view.deviceId,
      raw_payload_json: view.rawPayload,
      sync_events: view.syncEvents,
      pdf_report_id: view.pdfReport?.id ?? null,
    },
  );

  return (
    <div className="admin-grid">
      <div className="row-actions" style={{ justifyContent: "space-between" }}>
        <Link href="/admin/inspections">Back to inspections</Link>
        <Link className="button secondary" href="/admin/reports">
          Open Reports
        </Link>
      </div>

      <section className="metric-grid compact">
        <SummaryCard
          label="Progress"
          value={`${view.summary.completedItems}/${view.summary.totalItems}`}
        />
        <SummaryCard label="Findings" tone={view.summary.findingsCount > 0 ? "warning" : "success"} value={view.summary.findingsCount} />
        <SummaryCard label="Drydock" tone={view.summary.drydockCount > 0 ? "danger" : "success"} value={view.summary.drydockCount} />
        <SummaryCard label="Open Validation" tone={openValidationCount > 0 ? "danger" : "success"} value={openValidationCount} />
        <SummaryCard label="Photos" value={view.photos.length} />
      </section>

      <section className="panel">
        <div className="section-heading">
          <div>
            <h2>{view.vessel?.name ?? "Unknown vessel"}</h2>
            <p className="muted">
              {view.inspectorName || "Unknown inspector"} / {view.templateLabel}
            </p>
          </div>
          <div className="row-actions">
            <StatusBadge status={view.status} />
            <PdfStatusBadge status={view.pdfStatus} />
          </div>
        </div>
        <div className="tabs">
          {[
            ["overview", "Overview"],
            ["findings", "Findings"],
            ["photos", "Photos"],
            ["checklist", "Checklist"],
            ["debug", "Sync Debug"],
          ].map(([value, label]) => (
            <button
              className={`tab-button ${tab === value ? "active" : ""}`}
              key={value}
              onClick={() => setTab(value as DetailTab)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {tab === "overview" ? (
        <div className="split-grid">
          <PageSection title="Inspection Overview">
            <dl className="detail-list">
              <div>
                <dt>Vessel</dt>
                <dd>{view.vessel?.name ?? "Not available"}</dd>
              </div>
              <div>
                <dt>IMO</dt>
                <dd>{view.vessel?.imo || "Not available"}</dd>
              </div>
              <div>
                <dt>Inspector</dt>
                <dd>{view.inspectorName || "Not available"}</dd>
              </div>
              <div>
                <dt>Employee No</dt>
                <dd>{view.inspectorEmployeeNo || "Not available"}</dd>
              </div>
              <div>
                <dt>Place</dt>
                <dd>{view.place || "Not available"}</dd>
              </div>
              <div>
                <dt>Started</dt>
                <dd>{formatDateTime(view.startedAt)}</dd>
              </div>
              <div>
                <dt>Submitted</dt>
                <dd>{formatDateTime(view.submittedAt)}</dd>
              </div>
              <div>
                <dt>Synced</dt>
                <dd>{formatDateTime(view.syncedAt)}</dd>
              </div>
            </dl>
          </PageSection>

          <PageSection title="PDF Report">
            <dl className="detail-list">
              <div>
                <dt>Inspection PDF Status</dt>
                <dd>
                  <PdfStatusBadge status={view.pdfStatus} />
                </dd>
              </div>
              <div>
                <dt>Report Status</dt>
                <dd>
                  {view.pdfReport ? (
                    <PdfStatusBadge status={view.pdfReport.status} />
                  ) : (
                    "No report record"
                  )}
                </dd>
              </div>
              <div>
                <dt>File Size</dt>
                <dd>{formatFileSize(view.pdfReport?.fileSizeBytes)}</dd>
              </div>
              <div>
                <dt>Generated</dt>
                <dd>{formatDateTime(view.pdfReport?.generatedAt)}</dd>
              </div>
              {view.pdfReport?.errorMessage ? (
                <div>
                  <dt>Error</dt>
                  <dd className="error">{view.pdfReport.errorMessage}</dd>
                </div>
              ) : null}
              <div>
                <dt>Report ID</dt>
                <dd className="code-row">
                  <ShortCode value={view.pdfReport?.id} />
                  {view.pdfReport?.id ? <CopyButton value={view.pdfReport.id} /> : null}
                </dd>
              </div>
            </dl>
            <div className="row-actions">
              {view.pdfReport?.downloadHref ? (
                <Link className="button secondary" href={view.pdfReport.downloadHref}>
                  Download PDF
                </Link>
              ) : null}
              <ActionForm
                action={regenerateAction}
                errorMessage="Unable to request PDF action."
                successMessage="PDF action requested."
              >
                {(pending) => (
                  <>
                    <input name="inspection_id" type="hidden" value={view.id} />
                    <SubmitPdfButton label={pdfActionLabel(view)} pending={pending} />
                  </>
                )}
              </ActionForm>
            </div>
          </PageSection>
        </div>
      ) : null}

      {tab === "findings" ? (
        <PageSection title="Findings">
          {view.findings.length > 0 ? (
            <div className="finding-list">
              {view.findings.map((finding) => (
                <article className="finding-card" key={finding.itemTemplateId}>
                  <div>
                    <strong>{finding.label}</strong>
                    <p className="muted">
                      {finding.sectionCode} / {finding.itemTemplateId}
                    </p>
                    {finding.remarks ? <p>{finding.remarks}</p> : null}
                  </div>
                  <div className="row-actions">
                    <StatusBadge status={finding.score === "4" ? "failed" : "warning"} label={`Score ${finding.score}`} />
                    {finding.missingRemarks ? <StatusBadge status="failed" label="Missing Remarks" /> : null}
                    {finding.missingBeforePhoto ? <StatusBadge status="failed" label="Missing Before Photo" /> : null}
                    {finding.missingAfterPhoto ? <StatusBadge status="failed" label="Missing After Photo" /> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="No findings or required evidence gaps found." />
          )}
        </PageSection>
      ) : null}

      {tab === "photos" ? (
        <PageSection title="Photo Evidence">
          <PhotoGrid photos={beforePhotos} title="Before Photos" />
          <PhotoGrid photos={afterPhotos} title="After Photos" />
        </PageSection>
      ) : null}

      {tab === "checklist" ? (
        <PageSection title="Checklist Summary">
          <div className="admin-list">
            {view.checklist.map((section) => (
              <details className="panel nested-panel" key={section.code}>
                <summary>
                  {section.code} {section.name}
                </summary>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Score</th>
                        <th>Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {section.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.label}</td>
                          <td>{item.score}</td>
                          <td>{item.remarks || "None"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            ))}
          </div>
        </PageSection>
      ) : null}

      {tab === "debug" ? (
        <PageSection
          actions={<CopyButton value={diagnosticsText} />}
          title="Sync Events / Debug"
        >
          <dl className="detail-list">
            <div>
              <dt>Inspection ID</dt>
              <dd className="code-row">
                <ShortCode value={view.id} />
                <CopyButton value={view.id} />
              </dd>
            </div>
            <div>
              <dt>Local ID</dt>
              <dd className="code-row">
                <ShortCode value={view.localId} />
                <CopyButton value={view.localId} />
              </dd>
            </div>
            <div>
              <dt>Device ID</dt>
              <dd className="code-row">
                <ShortCode value={view.deviceId} />
                <CopyButton value={view.deviceId} />
              </dd>
            </div>
          </dl>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Event</th>
                  <th>Status</th>
                  <th>Retryable</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>
                {view.syncEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDateTime(event.occurredAt)}</td>
                    <td>{event.eventType}</td>
                    <td>
                      <StatusBadge status={event.status} />
                    </td>
                    <td>{event.retryable ? "Yes" : "No"}</td>
                    <td>
                      <pre className="checksum">
                        {event.error ? safeJsonPreview(event.error, 0) : ""}
                      </pre>
                    </td>
                  </tr>
                ))}
                {view.syncEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5}>No sync events found for this inspection.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <details>
            <summary>Raw Payload</summary>
            <pre className="json-preview">{safeJsonPreview(view.rawPayload)}</pre>
          </details>
        </PageSection>
      ) : null}
    </div>
  );
}
