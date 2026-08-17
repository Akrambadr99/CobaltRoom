import { useWorkspaceAnalytics } from '../../features/dashboard/dashboard-queries'
import './pages.css'

export function AnalyticsPage() {
  const analytics = useWorkspaceAnalytics()

  if (analytics.isPending) {
    return (
      <section className="page" aria-labelledby="analytics-title" aria-busy="true">
        <AnalyticsHeader />
        <div className="dashboard-state" role="status">Loading analytics…</div>
      </section>
    )
  }

  if (analytics.isError) {
    return (
      <section className="page" aria-labelledby="analytics-title">
        <AnalyticsHeader />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Analytics are unavailable</h2>
          <p>The aggregate request did not complete.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void analytics.refetch()}
          >
            Retry analytics
          </button>
        </div>
      </section>
    )
  }

  return (
    <section className="page" aria-labelledby="analytics-title">
      <AnalyticsHeader />
      <p className="analytics-generated">
        Snapshot generated{' '}
        <time dateTime={analytics.data.generatedAt}>
          {formatTimestamp(analytics.data.generatedAt)}
        </time>
      </p>

      <dl className="metric-grid" aria-label="Delivery metrics">
        <Metric label="Open issues" value={analytics.data.openIssues} />
        <Metric label="Completed issues" value={analytics.data.completedIssues} />
        <Metric label="Overdue issues" value={analytics.data.overdueIssues} />
      </dl>

      <div className="analytics-grid">
        <section className="work-panel" aria-labelledby="priority-distribution-title">
          <div className="work-panel__header">
            <div>
              <p className="page-eyebrow">Distribution</p>
              <h2 id="priority-distribution-title">Issues by priority</h2>
            </div>
          </div>
          <dl className="analytics-breakdown">
            {analytics.data.priorities.map(({ value, count }) => (
              <div key={value}>
                <dt>{formatLabel(value)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="work-panel" aria-labelledby="status-distribution-title">
          <div className="work-panel__header">
            <div>
              <p className="page-eyebrow">Workflow</p>
              <h2 id="status-distribution-title">Issues by status category</h2>
            </div>
          </div>
          <dl className="analytics-breakdown">
            {analytics.data.statusCategories.map(({ value, count }) => (
              <div key={value}>
                <dt>{formatLabel(value)}</dt>
                <dd>{count}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="work-panel" aria-labelledby="project-health-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Portfolio</p>
            <h2 id="project-health-title">Project delivery health</h2>
          </div>
        </div>
        <div className="analytics-table-scroll">
          <table className="analytics-table">
            <caption className="visually-hidden">
              Project issue volume, completion, urgency, and overdue work
            </caption>
            <thead>
              <tr>
                <th scope="col">Project</th>
                <th scope="col">Open</th>
                <th scope="col">Completed</th>
                <th scope="col">Urgent</th>
                <th scope="col">Overdue</th>
                <th scope="col">Completion</th>
              </tr>
            </thead>
            <tbody>
              {analytics.data.projects.map((project) => (
                <tr key={project.projectId}>
                  <th scope="row">
                    <span>{project.projectKey}</span>
                    {project.projectName}
                  </th>
                  <td>{project.openIssues}</td>
                  <td>{project.completedIssues}</td>
                  <td>{project.urgentOpenIssues}</td>
                  <td>{project.overdueIssues}</td>
                  <td>{project.completionPercent}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  )
}

function AnalyticsHeader() {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace intelligence</p>
      <h1 id="analytics-title">Analytics</h1>
      <p>Review authoritative delivery aggregates across the workspace.</p>
    </header>
  )
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="metric-card"><dt>{label}</dt><dd>{value}</dd></div>
}

function formatLabel(value: string): string {
  return value.replaceAll('-', ' ').replace(/^./, (character) => character.toUpperCase())
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
