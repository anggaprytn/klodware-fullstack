"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  formatDateTime,
  formatFileSize,
  pdfStatusLabel,
  shortenId,
  statusTone,
} from "@/lib/admin-format";
import type { PdfStatus } from "@/lib/types";
import {
  Badge,
  EmptyState,
  PageSection,
  PdfStatusBadge,
  ShortCode,
  SummaryCard,
} from "../components/AdminUi";
import { CopyButton } from "../components/CopyButton";

type RegenerateAction = (formData: FormData) => Promise<void>;

export type AdminReportRow = {
  rowId: string;
  reportId: string;
  inspectionId: string;
  inspectionLocalId: string;
  vesselName: string;
  inspectorName: string;
  submittedAt: string;
  generatedAt: string;
  status: PdfStatus;
  fileSizeBytes: number;
  errorMessage: string;
  downloadHref: string;
  metadata: unknown;
};

function SubmitPdfButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button className="button" disabled={pending} type="submit">
      {pending ? "Requesting..." : label}
    </button>
  );
}

function ReportActions({
  regenerateAction,
  row,
}: {
  regenerateAction: RegenerateAction;
  row: AdminReportRow;
}) {
  if (row.status === "ready") {
    return (
      <div className="row-actions">
        {row.downloadHref ? (
          <Link className="button secondary" href={row.downloadHref}>
            Download
          </Link>
        ) : null}
        <Link className="button secondary" href={`/admin/inspections/${row.inspectionId}`}>
          View
        </Link>
        <form action={regenerateAction}>
          <input name="inspection_id" type="hidden" value={row.inspectionId} />
          <SubmitPdfButton label="Regenerate" />
        </form>
      </div>
    );
  }

  if (row.status === "failed") {
    return (
      <div className="row-actions">
        <Link className="button secondary" href={`/admin/inspections/${row.inspectionId}`}>
          View Error
        </Link>
        <form action={regenerateAction}>
          <input name="inspection_id" type="hidden" value={row.inspectionId} />
          <SubmitPdfButton label="Retry Generate" />
        </form>
      </div>
    );
  }

  if (row.status === "queued" || row.status === "generating") {
    return (
      <div className="row-actions">
        <button className="button secondary" onClick={() => window.location.reload()} type="button">
          Refresh Status
        </button>
        <button className="button secondary" disabled type="button">
          Download
        </button>
      </div>
    );
  }

  return (
    <form action={regenerateAction}>
      <input name="inspection_id" type="hidden" value={row.inspectionId} />
      <SubmitPdfButton label="Generate PDF" />
    </form>
  );
}

function ReportDrawer({
  onClose,
  regenerateAction,
  row,
}: {
  onClose: () => void;
  regenerateAction: RegenerateAction;
  row: AdminReportRow;
}) {
  const [tab, setTab] = useState<"overview" | "error" | "diagnostics">("overview");
  const diagnostics = JSON.stringify(
    {
      report_id: row.reportId || null,
      inspection_id: row.inspectionId,
      inspection_local_id: row.inspectionLocalId,
      status: row.status,
      generated_at: row.generatedAt || null,
      file_size_bytes: row.fileSizeBytes,
      download_url_present: Boolean(row.downloadHref),
      metadata_json: row.metadata,
    },
    null,
    2,
  );

  return (
    <>
      <button
        aria-label="Close report detail"
        className="drawer-backdrop"
        onClick={onClose}
        type="button"
      />
      <aside className="drawer" role="dialog" aria-modal="true">
        <div className="drawer-header">
          <div>
            <h2>{row.vesselName || "Report Detail"}</h2>
            <p className="muted">{row.inspectorName || "Unknown inspector"}</p>
          </div>
          <button className="drawer-close" onClick={onClose} type="button">
            Close
          </button>
        </div>
        <div className="drawer-body">
          <div className="tabs">
            {[
              ["overview", "Overview"],
              ["error", "Error"],
              ["diagnostics", "Diagnostics"],
            ].map(([value, label]) => (
              <button
                className={`tab-button ${tab === value ? "active" : ""}`}
                key={value}
                onClick={() => setTab(value as "overview" | "error" | "diagnostics")}
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "overview" ? (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Vessel</dt>
                  <dd>{row.vesselName || "Not available"}</dd>
                </div>
                <div>
                  <dt>Inspector</dt>
                  <dd>{row.inspectorName || "Not available"}</dd>
                </div>
                <div>
                  <dt>Inspection Submitted</dt>
                  <dd>{formatDateTime(row.submittedAt)}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{formatDateTime(row.generatedAt)}</dd>
                </div>
                <div>
                  <dt>File Size</dt>
                  <dd>{formatFileSize(row.fileSizeBytes)}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    <PdfStatusBadge status={row.status} />
                  </dd>
                </div>
              </dl>
              <ReportActions regenerateAction={regenerateAction} row={row} />
            </>
          ) : null}

          {tab === "error" ? (
            row.errorMessage ? (
              <div>
                <h3>Error Summary</h3>
                <p className="error">{row.errorMessage}</p>
                <ReportActions regenerateAction={regenerateAction} row={row} />
              </div>
            ) : (
              <EmptyState title="No report error recorded." />
            )
          ) : null}

          {tab === "diagnostics" ? (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Report ID</dt>
                  <dd className="code-row">
                    <ShortCode value={row.reportId} />
                    {row.reportId ? <CopyButton value={row.reportId} /> : null}
                  </dd>
                </div>
                <div>
                  <dt>Inspection ID</dt>
                  <dd className="code-row">
                    <ShortCode value={row.inspectionId} />
                    <CopyButton value={row.inspectionId} />
                  </dd>
                </div>
              </dl>
              <div className="row-actions">
                <CopyButton value={diagnostics} />
              </div>
              <pre className="json-preview">{diagnostics}</pre>
            </>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function dateValue(value: string) {
  return value ? Date.parse(value) : 0;
}

export function AdminReportsClient({
  regenerateAction,
  rows,
  totalReportRecords,
}: {
  regenerateAction: RegenerateAction;
  rows: AdminReportRow[];
  totalReportRecords: number;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<AdminReportRow | null>(null);

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return rows
      .filter((row) => {
        const searchText = [
          row.vesselName,
          row.inspectorName,
          row.reportId,
          row.inspectionId,
          row.inspectionLocalId,
        ]
          .join(" ")
          .toLowerCase();

        return (
          (!normalizedQuery || searchText.includes(normalizedQuery)) &&
          (!status || row.status === status)
        );
      })
      .sort(
        (left, right) =>
          dateValue(right.generatedAt || right.submittedAt) -
          dateValue(left.generatedAt || left.submittedAt),
      );
  }, [query, rows, status]);

  const readyCount = rows.filter((row) => row.status === "ready").length;
  const generatingCount = rows.filter(
    (row) => row.status === "queued" || row.status === "generating",
  ).length;
  const failedCount = rows.filter((row) => row.status === "failed").length;
  const pendingCount = rows.filter((row) => row.status === "not_requested").length;
  const totalSize = rows.reduce((total, row) => total + row.fileSizeBytes, 0);

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Total Reports" value={totalReportRecords} />
        <SummaryCard label="PDF Ready" tone="success" value={readyCount} />
        <SummaryCard label="Generating" tone={generatingCount > 0 ? "warning" : "success"} value={generatingCount} />
        <SummaryCard label="Failed" tone={failedCount > 0 ? "danger" : "success"} value={failedCount} />
        <SummaryCard label="Pending" tone={pendingCount > 0 ? "warning" : "success"} value={pendingCount} />
        <SummaryCard label="Total Size" value={formatFileSize(totalSize)} />
      </section>

      <PageSection title="PDF Report Operations">
        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Vessel, inspector, report ID, inspection ID"
              value={query}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All</option>
              <option value="ready">PDF Ready</option>
              <option value="queued">Generating</option>
              <option value="generating">Generating</option>
              <option value="failed">Failed</option>
              <option value="not_requested">Pending</option>
            </select>
          </label>
        </div>

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Inspector</th>
                  <th>Inspection</th>
                  <th>Status</th>
                  <th>File Size</th>
                  <th>Generated</th>
                  <th>Error Summary</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.rowId}>
                    <td>{row.vesselName || "Not available"}</td>
                    <td>{row.inspectorName || "Not available"}</td>
                    <td>
                      <div className="record-title">
                        <Link href={`/admin/inspections/${row.inspectionId}`}>
                          {shortenId(row.inspectionLocalId || row.inspectionId, 10)}
                        </Link>
                        <span className="muted">Report {shortenId(row.reportId, 8)}</span>
                      </div>
                    </td>
                    <td>
                      <Badge label={pdfStatusLabel(row.status)} tone={statusTone(row.status)} />
                    </td>
                    <td>{formatFileSize(row.fileSizeBytes)}</td>
                    <td>{formatDateTime(row.generatedAt)}</td>
                    <td>{row.errorMessage || "None"}</td>
                    <td className="actions-cell">
                      <div className="row-actions">
                        <button
                          className="button secondary"
                          onClick={() => setSelected(row)}
                          type="button"
                        >
                          Details
                        </button>
                        <ReportActions regenerateAction={regenerateAction} row={row} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={rows.length === 0 ? "No report operations found." : "No reports match the current filters."} />
        )}
      </PageSection>

      {selected ? (
        <ReportDrawer
          onClose={() => setSelected(null)}
          regenerateAction={regenerateAction}
          row={selected}
        />
      ) : null}
    </div>
  );
}
