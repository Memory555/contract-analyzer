export function SkeletonResultView() {
  return (
    <section className="results skeleton-results">
      <div className="result-heading">
        <div>
          <div className="skeleton-line w60" />
          <div className="skeleton-line w40" />
        </div>
        <div className="confidence">
          <span className="skeleton-badge" />
          <span className="skeleton-badge" />
          <span className="skeleton-badge" />
        </div>
      </div>

      <section className="panel issue-panel skeleton-panel">
        <div className="panel-title compact">
          <div className="skeleton-line w30" />
          <div className="issue-counts">
            <span className="skeleton-badge" />
            <span className="skeleton-badge" />
            <span className="skeleton-badge" />
          </div>
        </div>
        <div className="skeleton-card" />
        <div className="skeleton-card" />
      </section>

      <section className="panel skeleton-panel">
        <div className="panel-title compact">
          <div className="skeleton-line w25" />
        </div>
        <div className="skeleton-table-row" />
        <div className="skeleton-table-row" />
        <div className="skeleton-table-row" />
      </section>
    </section>
  );
}
