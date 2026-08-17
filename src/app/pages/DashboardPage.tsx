import { useState, type ChangeEvent } from 'react'

import {
  useDashboardData,
  useUpdateIssuePriority,
} from '../../features/dashboard/dashboard-queries'
import type { Issue, IssuePriority } from '../../domain'
import './pages.css'

const issuePriorities = ['urgent', 'high', 'medium', 'low', 'none'] as const

export function DashboardPage() {
  const { issues, projects } = useDashboardData()
  const updatePriority = useUpdateIssuePriority()
  const [mutationMessage, setMutationMessage] = useState<string | null>(null)

  if (issues.isPending || projects.isPending) {
    return (
      <section className="page" aria-labelledby="dashboard-title" aria-busy="true">
        <DashboardHeader />
        <div className="dashboard-state" role="status">
          Loading workspace overview…
        </div>
      </section>
    )
  }

  if (issues.isError || projects.isError) {
    return (
      <section className="page" aria-labelledby="dashboard-title">
        <DashboardHeader />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Workspace data is unavailable</h2>
          <p>The local service could not load the dashboard. Try the request again.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void Promise.all([issues.refetch(), projects.refetch()])
            }}
          >
            Retry dashboard
          </button>
        </div>
      </section>
    )
  }

  const handlePriorityChange = (
    issue: Issue,
    event: ChangeEvent<HTMLSelectElement>,
  ): void => {
    const priority = parseIssuePriority(event.currentTarget.value)
    setMutationMessage(null)
    updatePriority.mutate(
      { issue, priority },
      {
        onSuccess: (updatedIssue) => {
          setMutationMessage(`Priority updated for ${updatedIssue.title}.`)
        },
        onError: () => {
          setMutationMessage('The priority update failed. Please try again.')
        },
      },
    )
  }

  return (
    <section className="page" aria-labelledby="dashboard-title">
      <DashboardHeader />

      <dl className="metric-grid" aria-label="Workspace summary">
        <div className="metric-card">
          <dt>Active projects</dt>
          <dd>{projects.data.filter(({ status }) => status === 'active').length}</dd>
        </div>
        <div className="metric-card">
          <dt>Tracked issues</dt>
          <dd>{issues.data.totalItems}</dd>
        </div>
        <div className="metric-card">
          <dt>Urgent in view</dt>
          <dd>
            {issues.data.items.filter(({ priority }) => priority === 'urgent').length}
          </dd>
        </div>
      </dl>

      <section className="work-panel" aria-labelledby="priority-work-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Priority queue</p>
            <h2 id="priority-work-title">Highest-priority work</h2>
          </div>
          <p>
            {issues.data.items.length} of {issues.data.totalItems} issues
          </p>
        </div>

        <ol className="issue-list">
          {issues.data.items.map((issue) => {
            const mutationIsPending =
              updatePriority.isPending &&
              updatePriority.variables.issue.id === issue.id

            return (
              <li className="issue-row" key={issue.id}>
                <div className="issue-row__summary">
                  <span className="issue-row__identifier">
                    #{issue.number} · {issue.type}
                  </span>
                  <strong>{issue.title}</strong>
                </div>
                <label className="priority-field">
                  <span>Priority for {issue.title}</span>
                  <select
                    value={issue.priority}
                    disabled={mutationIsPending}
                    onChange={(event) => {
                      handlePriorityChange(issue, event)
                    }}
                  >
                    {issuePriorities.map((priority) => (
                      <option key={priority} value={priority}>
                        {formatPriority(priority)}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            )
          })}
        </ol>

        {mutationMessage ? (
          <p
            className="mutation-status"
            role={updatePriority.isError ? 'alert' : 'status'}
          >
            {mutationMessage}
          </p>
        ) : null}
      </section>
    </section>
  )
}

function DashboardHeader() {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace overview</p>
      <h1 id="dashboard-title">Dashboard</h1>
      <p>
        Monitor project health, prioritize active work, and keep delivery signals
        visible.
      </p>
    </header>
  )
}

function parseIssuePriority(value: string): IssuePriority {
  if (issuePriorities.some((priority) => priority === value)) {
    return value as IssuePriority
  }

  throw new TypeError(`Unsupported issue priority: ${value}`)
}

function formatPriority(priority: IssuePriority): string {
  return priority === 'none'
    ? 'No priority'
    : `${priority[0]?.toLocaleUpperCase() ?? ''}${priority.slice(1)}`
}
