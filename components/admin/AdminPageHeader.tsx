import type { ReactNode } from "react";

export function AdminPageHeader({
  actions,
  description,
  eyebrow = "Operations Console",
  title,
}: {
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <p className="admin-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions ? <div className="row-actions">{actions}</div> : null}
    </div>
  );
}
