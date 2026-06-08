import { ClipboardList } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="empty-state">
      <ClipboardList aria-hidden="true" className="empty-state__icon" />
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="row-actions">{action}</div> : null}
    </div>
  );
}
