export default function ConsoleLoading() {
  return (
    <div className="admin-route-loading" role="status" aria-live="polite">
      <div className="admin-page-header admin-page-header--loading">
        <div>
          <div className="skeleton-line skeleton-line--eyebrow" />
          <div className="skeleton-line skeleton-line--title" />
          <div className="skeleton-line skeleton-line--description" />
        </div>
      </div>
      <div className="admin-grid">
        <section className="metric-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div className="admin-stat-card admin-stat-card--loading" key={index}>
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--value" />
              <div className="skeleton-line skeleton-line--wide" />
            </div>
          ))}
        </section>
        <section className="admin-section admin-section--loading">
          <div className="skeleton-line skeleton-line--section-title" />
          <div className="loading-table">
            {Array.from({ length: 6 }).map((_, index) => (
              <div className="loading-table__row" key={index}>
                <div className="skeleton-line" />
                <div className="skeleton-line" />
                <div className="skeleton-line skeleton-line--short" />
              </div>
            ))}
          </div>
        </section>
      </div>
      <span className="sr-only">Loading admin page</span>
    </div>
  );
}
