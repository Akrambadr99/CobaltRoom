import { useState, type ChangeEvent } from 'react'

import {
  useDashboardData,
  useUpdateIssuePriority,
} from '../../features/dashboard/dashboard-queries'
import type { WorkspaceAnalytics } from '../../data'
import type { Issue, IssuePriority } from '../../domain'
import {
  dashboardWidgetIds,
  PreferencePersistenceError,
  useUserPreferences,
  type DashboardWidgetId,
} from '../../preferences'
import { useAppServices } from '../providers/app-services-context'
import { useAuthorization } from '../providers/authorization-context'
import './pages.css'

const issuePriorities = ['urgent', 'high', 'medium', 'low', 'none'] as const

export function DashboardPage() {
  const services = useAppServices()
  const authorization = useAuthorization()
  const { analytics, issues } = useDashboardData()
  const preferences = useUserPreferences()
  const updatePriority = useUpdateIssuePriority()
  const [mutationMessage, setMutationMessage] = useState<string | null>(null)
  const [customizing, setCustomizing] = useState(false)
  const [preferenceError, setPreferenceError] = useState('')

  if (issues.isPending || analytics.isPending) {
    return (
      <section className="page" aria-labelledby="dashboard-title" aria-busy="true">
        <DashboardHeader />
        <div className="dashboard-state" role="status">
          Loading workspace overview…
        </div>
      </section>
    )
  }

  if (issues.isError || analytics.isError) {
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
              void Promise.all([issues.refetch(), analytics.refetch()])
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

      <div className="dashboard-customize">
        <button
          className="secondary-button"
          type="button"
          aria-expanded={customizing}
          onClick={() => {
            setCustomizing((current) => !current)
          }}
        >
          Customize dashboard
        </button>
        {customizing ? (
          <fieldset>
            <legend>Visible metrics</legend>
            {dashboardWidgetIds.map((widgetId) => {
              const selected = preferences.dashboardWidgets.includes(widgetId)
              return (
                <label key={widgetId}>
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={selected && preferences.dashboardWidgets.length === 1}
                    onChange={(event) => {
                      const next = event.currentTarget.checked
                        ? [...preferences.dashboardWidgets, widgetId]
                        : preferences.dashboardWidgets.filter((id) => id !== widgetId)
                      setPreferenceError('')
                      try {
                        services.preferences.setDashboardWidgets(next)
                      } catch (error) {
                        setPreferenceError(
                          error instanceof PreferencePersistenceError
                            ? error.message
                            : 'Dashboard settings could not be updated.',
                        )
                      }
                    }}
                  />
                  {widgetDefinitions[widgetId].label}
                </label>
              )
            })}
          </fieldset>
        ) : null}
        {preferenceError ? <p role="alert">{preferenceError}</p> : null}
      </div>

      <dl className="metric-grid" aria-label="Workspace summary">
        {preferences.dashboardWidgets.map((widgetId) => (
          <div className="metric-card" key={widgetId}>
            <dt>{widgetDefinitions[widgetId].label}</dt>
            <dd>{widgetDefinitions[widgetId].value(analytics.data)}</dd>
          </div>
        ))}
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
            const canUpdate = authorization.can('issue:update', issue.projectId)
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
                    disabled={!canUpdate || mutationIsPending}
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

const widgetDefinitions: Readonly<
  Record<DashboardWidgetId, { readonly label: string; value(data: WorkspaceAnalytics): number }>
> = {
  'active-projects': { label: 'Active projects', value: (data) => data.activeProjects },
  'total-issues': { label: 'Tracked issues', value: (data) => data.totalIssues },
  'urgent-open': { label: 'Urgent open issues', value: (data) => data.urgentOpenIssues },
  overdue: { label: 'Overdue issues', value: (data) => data.overdueIssues },
  'unassigned-open': {
    label: 'Unassigned open issues',
    value: (data) => data.unassignedOpenIssues,
  },
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
