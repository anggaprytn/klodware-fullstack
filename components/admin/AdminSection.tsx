import type { ReactNode } from "react";

export function AdminSection({
  actions,
  children,
  description,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <section className="admin-section">
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
