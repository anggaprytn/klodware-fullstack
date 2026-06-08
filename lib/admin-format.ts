import type { PdfStatus } from "./types";

export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "violet"
  | "orange"
  | "sky";

const dateFormatter = new Intl.DateTimeFormat("en", {
  day: "numeric",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "short",
  year: "numeric",
});

export function humanizeStatus(value: string | null | undefined) {
  if (!value) return "Unknown";

  const normalized = value.replace(/_/g, " ").trim();
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const formatStatusLabel = humanizeStatus;

export function pdfStatusLabel(status: PdfStatus | "pending" | "regenerating") {
  if (status === "ready") return "PDF Ready";
  if (status === "queued") return "Generating";
  if (status === "not_requested") return "Pending";
  if (status === "failed") return "Failed";
  return humanizeStatus(status);
}

export function statusTone(value: string | null | undefined): StatusTone {
  switch (value) {
    case "active":
    case "ready":
    case "valid":
    case "success":
    case "synced":
      return "success";
    case "submitted":
      return "info";
    case "queued":
    case "pending":
    case "not_requested":
    case "warning":
      return "warning";
    case "generating":
      return "sky";
    case "findings":
      return "orange";
    case "failed":
    case "invalid":
    case "drydock":
      return "danger";
    case "inactive":
    case "draft":
      return "neutral";
    case "locked":
      return "violet";
    default:
      return "neutral";
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";

  return dateFormatter.format(date);
}

export function formatFileSize(bytes: number | null | undefined) {
  const value = bytes ?? 0;
  if (value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let size = value;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export const formatBytes = formatFileSize;

export function shortenId(value: string | null | undefined, edge = 8) {
  if (!value) return "Not available";
  if (value.length <= edge * 2 + 3) return value;
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

export function hasPocketBaseFile(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

const sensitiveKeyPattern = /authorization|bearer|cookie|credential|password|secret|signed|token/i;

function scrubJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrubJson);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, child]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[redacted]" : scrubJson(child),
      ]),
    );
  }

  return value;
}

export function safeJsonPreview(value: unknown, spaces = 2) {
  try {
    return JSON.stringify(scrubJson(value), null, spaces);
  } catch {
    return "Unable to render JSON preview.";
  }
}

export function getInitials(value: string | null | undefined) {
  const parts = (value ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "KW";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
