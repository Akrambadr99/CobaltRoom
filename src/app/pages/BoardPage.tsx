import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import {
  useBoardIssues,
  useBoardMetadata,
  useMoveBoardIssue,
} from '../../features/board/board-queries'
import { GatewayError } from '../../data'
import type { Issue, WorkflowStatusId } from '../../domain'
import { useAuthorization } from '../providers/authorization-context'
import './board-page.css'
import './pages.css'

export function BoardPage() {
  const authorization = useAuthorization()
  const [searchParams, setSearchParams] = useSearchParams()
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const metadata = useBoardMetadata()
  const requestedProjectId = searchParams.get('project')
  const selectedProject =
    metadata.data?.projects.find(
      ({ project }) => project.id === requestedProjectId,
    ) ?? metadata.data?.projects[0]
  const projectId = selectedProject?.project.id ?? null
  const issues = useBoardIssues(projectId)
  const moveIssue = useMoveBoardIssue(projectId)

  useEffect(() => {
    if (!selectedProject || requestedProjectId === selectedProject.project.id) {
      return
    }

    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current)
        next.set('project', selectedProject.project.id)
        return next
      },
      { replace: true },
    )
  }, [requestedProjectId, selectedProject, setSearchParams])

  if (metadata.isPending) {
    return <BoardState busy status="Loading project workflows…" />
  }

  if (metadata.isError) {
    return (
      <BoardState
        alert
        status="Project workflows are unavailable."
        actionLabel="Retry board"
        onAction={() => {
          void metadata.refetch()
        }}
      />
    )
  }

  if (!selectedProject) {
    return (
      <BoardState status="There are no active project workflows to display." />
    )
  }

  const handleProjectChange = (event: ChangeEvent<HTMLSelectElement>): void => {
    const nextProjectId = event.currentTarget.value
    setAnnouncement(null)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set('project', nextProjectId)
      return next
    })
  }

  const handleStatusChange = (
    issue: Issue,
    event: ChangeEvent<HTMLSelectElement>,
  ): void => {
    const statusId = parseStatusId(
      event.currentTarget.value,
      selectedProject.statuses.map(({ id }) => id),
    )
    const targetStatus = selectedProject.statuses.find(({ id }) => id === statusId)
    setAnnouncement(null)
    moveIssue.mutate(
      { issue, statusId },
      {
        onSuccess: () => {
          setAnnouncement(`${issue.title} moved to ${targetStatus?.name ?? 'status'}.`)
        },
        onError: (error) => {
          setAnnouncement(formatMoveError(error, issue.title))
        },
      },
    )
  }

  return (
    <section className="page board-page" aria-labelledby="board-title">
      <header className="board-header">
        <div>
          <p className="page-eyebrow">Delivery workflow</p>
          <h1 id="board-title">Board</h1>
          <p>Move work through the project workflow with keyboard-ready controls.</p>
        </div>
        <label className="board-project-picker">
          <span>Project</span>
          <select value={selectedProject.project.id} onChange={handleProjectChange}>
            {metadata.data.projects.map(({ project }) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p className="board-instructions" id="board-move-instructions">
        Use each issue’s status menu to move it without drag and drop. Changes save
        immediately and return to the previous status if the request fails.
      </p>

      {issues.isPending ? (
        <div className="board-state" role="status" aria-busy="true">
          Loading {selectedProject.project.name} issues…
        </div>
      ) : null}

      {issues.isError ? (
        <div className="board-state board-state--error" role="alert">
          <h2>Board issues are unavailable</h2>
          <p>The current project could not be loaded. Try the request again.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              void issues.refetch()
            }}
          >
            Retry issues
          </button>
        </div>
      ) : null}

      {issues.isSuccess ? (
        <div
          className="kanban-board"
          aria-label={`${selectedProject.project.name} workflow board`}
        >
          {selectedProject.statuses.map((status) => {
            const statusIssues = issues.data.items.filter(
              ({ statusId }) => statusId === status.id,
            )

            return (
              <section
                className="kanban-column"
                aria-labelledby={`status-${status.id}`}
                key={status.id}
              >
                <header className="kanban-column__header">
                  <h2 id={`status-${status.id}`}>{status.name}</h2>
                  <span aria-label={`${String(statusIssues.length)} issues`}>
                    {statusIssues.length}
                  </span>
                </header>
                {statusIssues.length === 0 ? (
                  <p className="kanban-column__empty">No issues in this status.</p>
                ) : (
                  <ol className="kanban-card-list">
                    {statusIssues.map((issue) => {
                      const canMove = authorization.can('issue:update', issue.projectId)
                      const isMoving =
                        moveIssue.isPending && moveIssue.variables.issue.id === issue.id

                      return (
                        <li key={issue.id}>
                          <article className="kanban-card">
                            <p className="kanban-card__identifier">
                              {selectedProject.project.key}-{issue.number} · {issue.type}
                            </p>
                            <h3>
                              <Link to={`/issues/${issue.id}`}>{issue.title}</Link>
                            </h3>
                            <div className="kanban-card__meta">
                              <span className={`priority-badge priority-badge--${issue.priority}`}>
                                {formatPriority(issue.priority)}
                              </span>
                              {issue.dueDate ? <span>Due {issue.dueDate}</span> : null}
                            </div>
                            <label className="kanban-card__move">
                              <span>Move {issue.title}</span>
                              <select
                                aria-describedby="board-move-instructions"
                                value={issue.statusId}
                                disabled={!canMove || isMoving || moveIssue.isPending}
                                onChange={(event) => {
                                  handleStatusChange(issue, event)
                                }}
                              >
                                {selectedProject.statuses.map((option) => (
                                  <option key={option.id} value={option.id}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </article>
                        </li>
                      )
                    })}
                  </ol>
                )}
              </section>
            )
          })}
        </div>
      ) : null}

      <p
        className="board-announcement"
        role={moveIssue.isError ? 'alert' : 'status'}
        aria-live="polite"
      >
        {announcement}
      </p>
    </section>
  )
}

interface BoardStateProps {
  readonly actionLabel?: string
  readonly alert?: boolean
  readonly busy?: boolean
  readonly onAction?: () => void
  readonly status: string
}

function BoardState({
  actionLabel,
  alert = false,
  busy = false,
  onAction,
  status,
}: BoardStateProps) {
  return (
    <section className="page" aria-labelledby="board-title">
      <header className="page-header">
        <p className="page-eyebrow">Delivery workflow</p>
        <h1 id="board-title">Board</h1>
        <p>Move work through project workflows with accessible controls.</p>
      </header>
      <div
        className={`board-state${alert ? ' board-state--error' : ''}`}
        role={alert ? 'alert' : 'status'}
        aria-busy={busy || undefined}
      >
        <p>{status}</p>
        {actionLabel && onAction ? (
          <button className="secondary-button" type="button" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    </section>
  )
}

function parseStatusId(
  value: string,
  validStatusIds: readonly WorkflowStatusId[],
): WorkflowStatusId {
  const statusId = validStatusIds.find((candidate) => candidate === value)
  if (!statusId) throw new TypeError(`Unsupported workflow status: ${value}`)
  return statusId
}

function formatMoveError(error: Error, issueTitle: string): string {
  if (error instanceof GatewayError && error.code === 'conflict') {
    return `${issueTitle} changed elsewhere. The latest board state has been restored.`
  }

  return `${issueTitle} could not be moved. Its previous status has been restored.`
}

function formatPriority(priority: Issue['priority']): string {
  return priority === 'none'
    ? 'No priority'
    : `${priority[0]?.toLocaleUpperCase() ?? ''}${priority.slice(1)}`
}
