import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { StatusTone } from "@/lib/admin-format";
import { cn } from "@/lib/utils";

const toneClasses: Record<StatusTone, string> = {
  danger: "text-red-700 bg-red-50 border-red-100",
  info: "text-blue-700 bg-blue-50 border-blue-100",
  neutral: "text-slate-700 bg-slate-50 border-slate-200",
  orange: "text-orange-700 bg-orange-50 border-orange-100",
  sky: "text-sky-700 bg-sky-50 border-sky-100",
  success: "text-emerald-700 bg-emerald-50 border-emerald-100",
  violet: "text-violet-700 bg-violet-50 border-violet-100",
  warning: "text-amber-800 bg-amber-50 border-amber-100",
};

export function AdminStatCard({
  className,
  helper,
  href,
  icon: Icon,
  label,
  tone = "neutral",
  value,
}: {
  className?: string;
  helper?: string;
  href?: string;
  icon?: LucideIcon;
  label: string;
  tone?: StatusTone;
  value: number | string;
}) {
  const content = (
    <>
      <div className="admin-stat-card__top">
        {Icon ? (
          <span className={cn("admin-stat-card__icon", toneClasses[tone])}>
            <Icon aria-hidden="true" />
          </span>
        ) : null}
        <span className="admin-stat-card__label">{label}</span>
      </div>
      <strong className="admin-stat-card__value">{value}</strong>
      {helper ? <span className="admin-stat-card__helper">{helper}</span> : null}
    </>
  );

  if (href) {
    return (
      <Link className={cn("admin-stat-card interactive", className)} href={href}>
        {content}
      </Link>
    );
  }

  return <div className={cn("admin-stat-card", className)}>{content}</div>;
}
