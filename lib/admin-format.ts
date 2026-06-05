import type { PdfStatus } from "./types";

export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "info";

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
    case "submitted":
    case "ready":
    case "valid":
    case "success":
    case "synced":
      return "success";
    case "queued":
    case "generating":
    case "pending":
    case "not_requested":
    case "draft":
      return "warning";
    case "failed":
    case "invalid":
    case "inactive":
      return "danger";
    case "locked":
      return "info";
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

export function shortenId(value: string | null | undefined, edge = 8) {
  if (!value) return "Not available";
  if (value.length <= edge * 2 + 3) return value;
  return `${value.slice(0, edge)}...${value.slice(-edge)}`;
}

export function hasPocketBaseFile(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}
