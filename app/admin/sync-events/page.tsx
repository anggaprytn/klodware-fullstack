import { AdminShell } from "../AdminShell";
import { requireAdminSession } from "@/lib/auth";
import { safeJsonPreview } from "@/lib/admin-format";
import { getSuperuserPocketBase } from "@/lib/pocketbase";
import type { SyncEventRecord } from "@/lib/types";
import {
  AdminSyncEventsClient,
  type AdminSyncEventRow,
} from "./SyncEventsClient";

function payloadInspectionId(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  return String(record.inspection_id ?? record.inspectionId ?? "");
}

function payloadMessage(payload: unknown, error: unknown) {
  const source =
    error && typeof error === "object"
      ? (error as Record<string, unknown>)
      : payload && typeof payload === "object"
        ? (payload as Record<string, unknown>)
        : null;

  return String(
    source?.message ??
      source?.error_message ??
      source?.code ??
      source?.event ??
      "Recorded sync event",
  );
}

export default async function AdminSyncEventsPage() {
  await requireAdminSession();
  const pb = await getSuperuserPocketBase();
  const events = await pb.collection("sync_events").getFullList<SyncEventRecord>({
    sort: "-occurred_at",
  });
  const rows: AdminSyncEventRow[] = events.map((event) => ({
    createdAt: event.occurred_at,
    deviceId: event.device_id ?? "",
    eventType: event.event_type,
    id: event.id,
    inspectionId: payloadInspectionId(event.payload_json),
    message: payloadMessage(event.payload_json, event.error_json),
    payloadPreview: safeJsonPreview({
      error_json: event.error_json ?? null,
      payload_json: event.payload_json ?? null,
      request_id: event.request_id ?? null,
      retryable: event.retryable ?? false,
    }),
    requestId: event.request_id ?? "",
    retryable: event.retryable ?? false,
    status: event.status,
  }));

  return (
    <AdminShell
      title="Sync Events"
      description="Review mobile sync diagnostics, validation failures, and device events."
    >
      <AdminSyncEventsClient rows={rows} />
    </AdminShell>
  );
}
