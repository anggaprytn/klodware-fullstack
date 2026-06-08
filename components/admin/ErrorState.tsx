import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

export function ErrorState({
  action,
  description,
  title = "Unable to load this admin view",
}: {
  action?: ReactNode;
  description?: string;
  title?: string;
}) {
  return (
    <div className="error-state">
      <AlertTriangle aria-hidden="true" />
      <strong>{title}</strong>
      {description ? <p>{description}</p> : null}
      {action ? <div className="row-actions">{action}</div> : null}
    </div>
  );
}
