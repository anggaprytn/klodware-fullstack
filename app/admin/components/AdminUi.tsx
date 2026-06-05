import Link from "next/link";
import {
  humanizeStatus,
  pdfStatusLabel,
  shortenId,
  statusTone,
  type StatusTone,
} from "@/lib/admin-format";
import type { PdfStatus } from "@/lib/types";

export function Badge({
  label,
  tone,
}: {
  label: string;
  tone?: StatusTone;
}) {
  return <span className={`status-badge ${tone ?? "neutral"}`}>{label}</span>;
}

export function StatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  return (
    <Badge
      label={label ?? humanizeStatus(status)}
      tone={statusTone(status)}
    />
  );
}

export function PdfStatusBadge({ status }: { status: PdfStatus }) {
  return (
    <Badge label={pdfStatusLabel(status)} tone={statusTone(status)} />
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel section-panel">
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          {description ? <p className="muted">{description}</p> : null}
        </div>
        {actions ? <div className="row-actions">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function SummaryCard({
  label,
  value,
  href,
  meta,
  tone = "neutral",
}: {
  label: string;
  value: number | string;
  href?: string;
  meta?: string;
  tone?: StatusTone;
}) {
  const body = (
    <>
      <span className={`metric-value ${tone}`}>{value}</span>
      <span className="metric-label">{label}</span>
      {meta ? <span className="metric-meta">{meta}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className="panel metric-card interactive" href={href}>
        {body}
      </Link>
    );
  }

  return <div className="panel metric-card">{body}</div>;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="row-actions">{action}</div> : null}
    </div>
  );
}

export function ShortCode({
  value,
  edge,
}: {
  value: string | null | undefined;
  edge?: number;
}) {
  return (
    <code className="checksum" title={value ?? ""}>
      {shortenId(value, edge)}
    </code>
  );
}
