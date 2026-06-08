import {
  humanizeStatus,
  pdfStatusLabel,
  statusTone,
  type StatusTone,
} from "@/lib/admin-format";
import type { PdfStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const toneClasses: Record<StatusTone, string> = {
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-blue-200 bg-blue-50 text-blue-700",
  neutral: "border-slate-200 bg-slate-100 text-slate-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
};

export function Badge({
  className,
  label,
  tone = "neutral",
}: {
  className?: string;
  label: string;
  tone?: StatusTone;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold leading-none",
        toneClasses[tone],
        className,
      )}
    >
      {label}
    </span>
  );
}

export function StatusBadge({
  label,
  status,
}: {
  label?: string;
  status: string;
}) {
  return (
    <Badge label={label ?? humanizeStatus(status)} tone={statusTone(status)} />
  );
}

export function PdfStatusBadge({ status }: { status: PdfStatus }) {
  return <Badge label={pdfStatusLabel(status)} tone={statusTone(status)} />;
}
