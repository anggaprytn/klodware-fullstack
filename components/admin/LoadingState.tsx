export function LoadingState({ title = "Loading admin data" }: { title?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span />
      <strong>{title}</strong>
    </div>
  );
}
