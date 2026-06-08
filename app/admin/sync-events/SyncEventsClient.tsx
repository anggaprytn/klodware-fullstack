"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "@/lib/admin-format";
import {
  Badge,
  EmptyState,
  PageSection,
  ShortCode,
  StatusBadge,
  SummaryCard,
} from "../components/AdminUi";
import { CopyButton } from "../components/CopyButton";

export type AdminSyncEventRow = {
  id: string;
  eventType: string;
  status: "success" | "failed";
  message: string;
  deviceId: string;
  inspectionId: string;
  requestId: string;
  retryable: boolean;
  createdAt: string;
  payloadPreview: string;
};

export function AdminSyncEventsClient({ rows }: { rows: AdminSyncEventRow[] }) {
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [status, setStatus] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [inspectionId, setInspectionId] = useState("");
  const [selected, setSelected] = useState<AdminSyncEventRow | null>(null);

  const eventTypes = useMemo(
    () => [...new Set(rows.map((row) => row.eventType).filter(Boolean))].sort(),
    [rows],
  );
  const deviceIds = useMemo(
    () => [...new Set(rows.map((row) => row.deviceId).filter(Boolean))].sort(),
    [rows],
  );
  const inspectionIds = useMemo(
    () => [...new Set(rows.map((row) => row.inspectionId).filter(Boolean))].sort(),
    [rows],
  );

  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return rows.filter((row) => {
      const searchText = [
        row.eventType,
        row.status,
        row.message,
        row.deviceId,
        row.inspectionId,
        row.requestId,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!normalized || searchText.includes(normalized)) &&
        (!eventType || row.eventType === eventType) &&
        (!status || row.status === status) &&
        (!deviceId || row.deviceId === deviceId) &&
        (!inspectionId || row.inspectionId === inspectionId)
      );
    });
  }, [deviceId, eventType, inspectionId, query, rows, status]);

  const failedCount = rows.filter((row) => row.status === "failed").length;
  const retryableCount = rows.filter((row) => row.retryable).length;
  const deviceCount = deviceIds.length;

  return (
    <div className="admin-grid">
      <section className="metric-grid compact">
        <SummaryCard label="Sync Events" value={rows.length} />
        <SummaryCard label="Failed" tone={failedCount > 0 ? "danger" : "success"} value={failedCount} />
        <SummaryCard label="Retryable" tone={retryableCount > 0 ? "warning" : "success"} value={retryableCount} />
        <SummaryCard label="Devices" value={deviceCount} />
      </section>

      <PageSection title="Sync Diagnostics">
        <div className="toolbar">
          <label className="field">
            <span>Search</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Message, device, inspection, request ID"
              value={query}
            />
          </label>
          <label className="field">
            <span>Event Type</span>
            <select onChange={(event) => setEventType(event.target.value)} value={eventType}>
              <option value="">All</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select onChange={(event) => setStatus(event.target.value)} value={status}>
              <option value="">All</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <label className="field">
            <span>Device</span>
            <select onChange={(event) => setDeviceId(event.target.value)} value={deviceId}>
              <option value="">All</option>
              {deviceIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Inspection</span>
            <select onChange={(event) => setInspectionId(event.target.value)} value={inspectionId}>
              <option value="">All</option>
              {inspectionIds.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
          </label>
        </div>

        {filteredRows.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Type</th>
                  <th>Status</th>
                  <th>Message</th>
                  <th>Device ID</th>
                  <th>Inspection ID</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.eventType}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td>
                      <div className="record-title">
                        <span>{row.message}</span>
                        {row.retryable ? <Badge label="Retryable" tone="warning" /> : null}
                      </div>
                    </td>
                    <td>
                      <ShortCode value={row.deviceId} />
                    </td>
                    <td>
                      <ShortCode value={row.inspectionId} />
                    </td>
                    <td>{formatDateTime(row.createdAt)}</td>
                    <td className="actions-cell">
                      <button
                        className="button secondary"
                        onClick={() => setSelected(row)}
                        type="button"
                      >
                        Raw Payload
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title={rows.length === 0 ? "No sync events found." : "No sync events match the current filters."} />
        )}
      </PageSection>

      {selected ? (
        <>
          <button
            aria-label="Close sync event payload"
            className="drawer-backdrop"
            onClick={() => setSelected(null)}
            type="button"
          />
          <aside className="drawer" role="dialog" aria-modal="true">
            <div className="drawer-header">
              <div>
                <h2>{selected.eventType}</h2>
                <p className="muted">{formatDateTime(selected.createdAt)}</p>
              </div>
              <button className="drawer-close" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>
            <div className="drawer-body">
              <dl className="detail-list">
                <div>
                  <dt>Request ID</dt>
                  <dd className="code-row">
                    <ShortCode value={selected.requestId} />
                    {selected.requestId ? <CopyButton value={selected.requestId} /> : null}
                  </dd>
                </div>
                <div>
                  <dt>Inspection ID</dt>
                  <dd className="code-row">
                    <ShortCode value={selected.inspectionId} />
                    {selected.inspectionId ? <CopyButton value={selected.inspectionId} /> : null}
                  </dd>
                </div>
              </dl>
              <div className="row-actions">
                <CopyButton value={selected.payloadPreview} />
              </div>
              <pre className="json-preview">{selected.payloadPreview}</pre>
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
