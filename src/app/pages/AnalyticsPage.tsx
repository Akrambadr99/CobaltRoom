import { Link, useSearchParams } from 'react-router-dom'

import type { AnalyticsRange } from '../../data'
import { useWorkspaceAnalytics } from '../../features/dashboard/dashboard-queries'
import './pages.css'

export function AnalyticsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const range = parseAnalyticsRange(searchParams.get('range'))
  const analytics = useWorkspaceAnalytics(range)

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
      <label className="analytics-range">
        <span>Time range</span>
        <select
          value={range}
          onChange={(event) => {
            const next = new URLSearchParams(searchParams)
            const value = parseAnalyticsRange(event.currentTarget.value)
            if (value === '30-days') next.delete('range')
            else next.set('range', value)
            setSearchParams(next)
          }}
        >
          <option value="30-days">Last 30 days</option>
          <option value="90-days">Last 90 days</option>
          <option value="all-time">All time</option>
        </select>
      </label>
      <p className="analytics-generated">
        Snapshot generated{' '}
        <time dateTime={analytics.data.generatedAt}>
          {formatTimestamp(analytics.data.generatedAt)}
        </time>
      </p>

      <dl className="metric-grid" aria-label="Delivery metrics">
        <Metric label="Open issues" value={analytics.data.openIssues} href="/issues" />
        <Metric label="Created in range" value={analytics.data.createdInRange} href="/issues?sort=createdAt&direction=descending" />
        <Metric label="Updated in range" value={analytics.data.updatedInRange} href="/issues?sort=updatedAt&direction=descending" />
      </dl>

      <section className="work-panel" aria-labelledby="issue-flow-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Trend</p>
            <h2 id="issue-flow-title">Issue flow over time</h2>
            <p>Created and last-updated issue volume in deterministic reporting periods.</p>
          </div>
        </div>
        <div className="analytics-table-scroll">
          <table className="analytics-table">
            <caption className="visually-hidden">
              Created and updated issue counts by reporting period
            </caption>
            <thead><tr><th scope="col">Period starting</th><th scope="col">Created</th><th scope="col">Updated</th></tr></thead>
            <tbody>
              {analytics.data.issueFlow.map((point) => (
                <tr key={point.periodStart}>
                  <th scope="row"><time dateTime={point.periodStart}>{formatDate(point.periodStart)}</time></th>
                  <td>{point.createdIssues}</td>
                  <td>{point.updatedIssues}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

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
                <dt><Link to={`/issues?priority=${value}`}>{formatLabel(value)}</Link></dt>
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
                    <Link to={`/projects/${project.projectId}`}>{project.projectName}</Link>
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

function Metric({ label, value, href }: Readonly<{ label: string; value: number; href: string }>) {
  return <div className="metric-card"><dt>{label}</dt><dd>{value}</dd><Link to={href}>View issues</Link></div>
}

function parseAnalyticsRange(value: string | null): AnalyticsRange {
  if (value === '90-days' || value === 'all-time') return value
  return '30-days'
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

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`))
}
