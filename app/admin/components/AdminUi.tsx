import { shortenId, type StatusTone } from "@/lib/admin-format";
import {
  Badge,
  PdfStatusBadge,
  StatusBadge,
} from "@/components/admin/StatusBadge";
import { AdminSection } from "@/components/admin/AdminSection";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { EmptyState } from "@/components/admin/EmptyState";

export { Badge, EmptyState, PdfStatusBadge, StatusBadge };

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
    <AdminSection actions={actions} description={description} title={title}>
      {children}
    </AdminSection>
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
  return (
    <AdminStatCard
      helper={meta}
      href={href}
      label={label}
      tone={tone}
      value={value}
    />
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
