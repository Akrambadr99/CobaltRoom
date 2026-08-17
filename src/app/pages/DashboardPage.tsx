import './pages.css'

export function DashboardPage() {
  return (
    <section className="page" aria-labelledby="dashboard-title">
      <header className="page-header">
        <p className="page-eyebrow">Workspace overview</p>
        <h1 id="dashboard-title">Dashboard</h1>
        <p>
          Your operational home for project health, active work, and delivery
          signals.
        </p>
      </header>

      <div className="foundation-grid">
        <article className="foundation-card">
          <p className="foundation-card__label">Application foundation</p>
          <h2>Ready</h2>
          <p>Routing, validation, and accessible navigation are available.</p>
        </article>
        <article className="foundation-card">
          <p className="foundation-card__label">Workspace data</p>
          <h2>Next</h2>
          <p>Deterministic domain fixtures will populate this view.</p>
        </article>
      </div>
    </section>
  )
}
