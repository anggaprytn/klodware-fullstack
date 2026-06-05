"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/admin-format";
import type { InspectionStatus, PdfStatus } from "@/lib/types";
import {
  EmptyState,
  PageSection,
  PdfStatusBadge,
  StatusBadge,
  SummaryCard,
} from "../components/AdminUi";

export type AdminInspectionListRow = {
  id: string;
  localId: string;
  vesselId: string;
  vesselName: string;
  imo: string;
  mmsi: string;
  inspectorName: string;
  status: InspectionStatus;
  pdfStatus: PdfStatus;
  submittedAt: string;
  syncedAt: string;
  findingsCount: number;
  drydockCount: number;
  completedItems: number;
  totalItems: number;
};

function progressLabel(row: AdminInspectionListRow) {
  if (row.totalItems <= 0) return "Not started";
  return `${row.completedItems}/${row.totalItems}`;
}

function dateValue(value: string) {
  return value ? Date.parse(value) : 0;
}

export function AdminInspectionsClient({
  rows,
}: {
  rows: AdminInspectionListRow[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pdfStatus, setPdfStatus] = useState("");
  const [vessel, setVessel] = useState("");
  const [inspector, setInspector] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [hasFindings, setHasFindings] = useState(false);
  const [hasDrydock, setHasDrydock] = useState(false);

  const vessels = useMemo(
    () =>
      [...new Map(rows.map((row) => [row.vesselId, row.vesselName])).entries()]
        .filter(([, name]) => name)
        .sort((left, right) => left[1].localeCompare(right[1])),
    [rows],
  );
  const inspectors = useMemo(
    () =>
      [...new Set(rows.map((row) => row.inspectorName).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const fromTime = from ? Date.parse(`${from}T00:00:00`) : 0;
    const toTime = to ? Date.parse(`${to}T23:59:59`) : 0;

    return rows.filter((row) => {
      const rowTime = dateValue(row.submittedAt || row.syncedAt);
      const searchText = [
        row.vesselName,
        row.inspectorName,
        row.id,
        row.localId,
        row.imo,
        row.mmsi,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalizedQuery || searchText.includes(normalizedQuery)) &&
        (!status || row.status === status) &&
        (!pdfStatus || row.pdfStatus === pdfStatus) &&
        (!vessel || row.vesselId === vessel) &&
        (!inspector || row.inspectorName === inspector) &&
        (!fromTime || rowTime >= fromTime) &&
        (!toTime || rowTime <= toTime) &&
        (!hasFindings || row.findingsCount > 0) &&
        (!hasDrydock || row.drydockCount > 0)
      );
    });
  }, [from, hasDrydock, hasFindings, inspector, pdfStatus, query, rows, status, to, vessel]);

  const submittedCount = rows.filter(
    (row) => row.status === "submitted" || row.status === "locked",
  ).length;
  const missingSyncTime = rows.filter((row) => !row.syncedAt).length;
  const pdfReadyCount = rows.filter((row) => row.pdfStatus === "ready").length;
  const pdfFailedCount = rows.filter((row) => row.pdfStatus === "failed").length;
  const findingsTotal = rows.reduce((total, row) => total + row.findingsCount, 0);

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Total Inspections" value={rows.length} />
        <SummaryCard label="Submitted" tone="success" value={submittedCount} />
        <SummaryCard
          label="Missing Sync Time"
          meta="Server records without synced_at"
          tone={missingSyncTime > 0 ? "warning" : "success"}
          value={missingSyncTime}
        />
        <SummaryCard label="PDF Ready" tone="success" value={pdfReadyCount} />
        <SummaryCard label="PDF Failed" tone={pdfFailedCount > 0 ? "danger" : "success"} value={pdfFailedCount} />
        <SummaryCard label="Findings Total" tone={findingsTotal > 0 ? "warning" : "success"} value={findingsTotal} />
      </section>

      <PageSection title="Inspection Review Queue">
        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Vessel, inspector, ID, IMO, MMSI"
              value={query}
            />
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="locked">Locked</option>
            </select>
          </label>
          <label className="field">
            <span>PDF Status</span>
            <select onChange={(event) => setPdfStatus(event.target.value)} value={pdfStatus}>
              <option value="">All</option>
              <option value="not_requested">Pending</option>
              <option value="queued">Generating</option>
              <option value="generating">Generating</option>
              <option value="ready">PDF Ready</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="field">
            <span>Vessel</span>
            <select onChange={(event) => setVessel(event.target.value)} value={vessel}>
              <option value="">All</option>
              {vessels.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Inspector</span>
            <select onChange={(event) => setInspector(event.target.value)} value={inspector}>
              <option value="">All</option>
              {inspectors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>From</span>
            <input onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
          </label>
          <label className="field">
            <span>To</span>
            <input onChange={(event) => setTo(event.target.value)} type="date" value={to} />
          </label>
          <label className="checkbox-field">
            <input
              checked={hasFindings}
              onChange={(event) => setHasFindings(event.target.checked)}
              type="checkbox"
            />
            <span>Has findings</span>
          </label>
          <label className="checkbox-field">
            <input
              checked={hasDrydock}
              onChange={(event) => setHasDrydock(event.target.checked)}
              type="checkbox"
            />
            <span>Has drydock</span>
          </label>
        </div>

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vessel</th>
                  <th>Inspector</th>
                  <th>Status</th>
                  <th>PDF</th>
                  <th>Progress</th>
                  <th>Findings</th>
                  <th>Drydock</th>
                  <th>Submitted / Synced</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="record-title">
                        <strong>{row.vesselName || "Unknown vessel"}</strong>
                        <span className="muted">
                          IMO {row.imo || "N/A"} / MMSI {row.mmsi || "N/A"}
                        </span>
                      </div>
                    </td>
                    <td>{row.inspectorName || "Not available"}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <PdfStatusBadge status={row.pdfStatus} />
                    </td>
                    <td>{progressLabel(row)}</td>
                    <td>{row.findingsCount}</td>
                    <td>{row.drydockCount}</td>
                    <td>
                      <div className="record-title">
                        <span>{formatDateTime(row.submittedAt)}</span>
                        <span className="muted">Synced {formatDateTime(row.syncedAt)}</span>
                      </div>
                    </td>
                    <td className="actions-cell">
                      <Link className="button secondary" href={`/admin/inspections/${row.id}`}>
                        View Detail
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={rows.length === 0 ? "No inspections found." : "No inspections match the current filters."} />
        )}
      </PageSection>
    </div>
  );
}
