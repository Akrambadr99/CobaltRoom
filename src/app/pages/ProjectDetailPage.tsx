import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type { MutableProjectFields } from '../../data/gateway/contracts'
import {
  projectId,
  type Project,
  type ProjectId,
  type ProjectStatus,
} from '../../domain'
import {
  useArchiveProject,
  useProjectActivity,
  useProjectDetail,
  useUpdateProject,
} from '../../features/projects/project-queries'
import { ProjectMembershipPanel } from '../../features/projects/ProjectMembershipPanel'
import { ProjectLeadTransferDialog } from '../../features/projects/ProjectLeadTransferDialog'
import { ProjectWorkflowPanel } from '../../features/projects/ProjectWorkflowPanel'
import {
  useProjectSubscriptionData,
  useSetProjectSubscription,
} from '../../features/projects/project-subscription-queries'
import { hasAppErrorKind } from '../errors/classify-app-error'
import { useAuthorization } from '../providers/authorization-context'
import './pages.css'

const allowedStatuses: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  planned: ['planned', 'active', 'paused', 'completed'],
  active: ['active', 'paused', 'completed'],
  paused: ['paused', 'active', 'completed'],
  completed: ['completed', 'active'],
  archived: ['archived'],
}

type ProjectAction = 'archive' | 'edit'

interface ProjectActionSession {
  readonly action: ProjectAction
  readonly permissionFingerprint: string
}

export function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>()
  const requestedProjectId = parseProjectId(params.projectId)
  return requestedProjectId ? (
    <LoadedProject projectId={requestedProjectId} />
  ) : (
    <ProjectNotFound />
  )
}

function LoadedProject({
  projectId: requestedId,
}: Readonly<{ projectId: ProjectId }>) {
  const [page, setPage] = useState(1)
  const [activityPage, setActivityPage] = useState(1)
  const [transferringLead, setTransferringLead] = useState(false)
  const [actionSession, setActionSession] = useState<ProjectActionSession | null>(
    null,
  )
  const [announcement, setAnnouncement] = useState('')
  const accessStatusRef = useRef<HTMLParagraphElement>(null)
  const authorization = useAuthorization()
  const { issues, metadata } = useProjectDetail(requestedId, page)
  const activity = useProjectActivity(requestedId, activityPage)
  const subscription = useProjectSubscriptionData(requestedId)
  const loadedProject = metadata.data?.project
  const canEdit = Boolean(
    loadedProject &&
    loadedProject.status !== 'archived' &&
    authorization.can('project:update', loadedProject.id),
  )
  const canArchive = Boolean(
    loadedProject &&
    loadedProject.status !== 'archived' &&
    authorization.can('project:archive', loadedProject.id),
  )
  const canTransferLead = Boolean(
    loadedProject &&
    loadedProject.status !== 'completed' &&
    loadedProject.status !== 'archived' &&
    authorization.can('project:update', loadedProject.id),
  )
  const actionAllowed =
    actionSession?.action === 'edit' ? canEdit : canArchive
  const accessChangedDuringAction =
    actionSession !== null &&
    (!actionAllowed ||
      actionSession.permissionFingerprint !==
        authorization.session.permissionFingerprint)
  const activeAction = accessChangedDuringAction ? null : actionSession?.action

  useEffect(() => {
    if (!accessChangedDuringAction || !metadata.isSuccess) return
    accessStatusRef.current?.focus()
  }, [accessChangedDuringAction, metadata.isSuccess])

  if (metadata.isPending || issues.isPending) return <ProjectLoading />
  if (hasAppErrorKind(metadata.error, 'not-found')) {
    return <ProjectNotFound />
  }
  if (metadata.isError || issues.isError) {
    return (
      <section className="page" aria-labelledby="project-detail-title">
        <ProjectDetailHeader title="Project" />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Project data is unavailable</h2>
          <p>The local service could not load this project.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void Promise.all([metadata.refetch(), issues.refetch()])}
          >
            Retry project
          </button>
        </div>
      </section>
    )
  }

  const { project } = metadata.data
  return (
    <section className="page" aria-labelledby="project-detail-title">
      <header className="project-detail-header">
        <Link className="text-link" to="/projects">
          ← Projects
        </Link>
        <div className="project-detail-header__content">
          <div>
            <p className="page-eyebrow">{project.key} · {project.status}</p>
            <h1 id="project-detail-title">{project.name}</h1>
            <p>{project.description}</p>
          </div>
          {canEdit || canArchive || canTransferLead ? (
            <div className="project-detail-actions">
              {canEdit ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setAnnouncement('')
                    setActionSession({
                      action: 'edit',
                      permissionFingerprint:
                        authorization.session.permissionFingerprint,
                    })
                  }}
                >
                  Edit project
                </button>
              ) : null}
              {canTransferLead ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setAnnouncement('')
                    setTransferringLead(true)
                  }}
                >
                  Transfer lead
                </button>
              ) : null}
              {canArchive ? (
                <button
                  className="danger-button"
                  type="button"
                  onClick={() => {
                    setAnnouncement('')
                    setActionSession({
                      action: 'archive',
                      permissionFingerprint:
                        authorization.session.permissionFingerprint,
                    })
                  }}
                >
                  Archive project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        {project.status === 'archived' ? (
          <p className="project-readonly-notice" role="status">
            This project is archived. Its issues and comments are read-only.
          </p>
        ) : null}
      </header>

      {accessChangedDuringAction ? (
        <p
          ref={accessStatusRef}
          className="project-readonly-notice"
          role="status"
          tabIndex={-1}
        >
          Your permission to {actionSession.action === 'edit' ? 'edit' : 'archive'}
          {' '}this project changed. No changes were saved.
        </p>
      ) : (
        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>
      )}

      <ProjectWatchPanel
        project={project}
        subscription={subscription}
        canSubscribe={authorization.can('project:subscribe', project.id)}
      />

      <section className="work-panel" aria-labelledby="project-issues-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Current scope</p>
            <h2 id="project-issues-title">Project issues</h2>
          </div>
          <p>
            {issues.data.totalItems}{' '}
            {issues.data.totalItems === 1 ? 'issue' : 'issues'}
          </p>
        </div>
        {issues.data.items.length > 0 ? (
          <ol className="project-issue-list">
            {issues.data.items.map((issue) => (
              <li key={issue.id}>
                <span>#{issue.number}</span>
                <strong>
                  <Link className="text-link" to={`/issues/${issue.id}`}>
                    {issue.title}
                  </Link>
                </strong>
                <span>Priority: {issue.priority}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="empty-panel__status">No issues in this project</p>
        )}
        {issues.data.pageCount > 1 ? (
          <nav className="project-pagination" aria-label="Project issues pagination">
            <button
              className="secondary-button"
              type="button"
              disabled={page <= 1}
              onClick={() => {
                setPage((value) => value - 1)
              }}
            >
              Previous
            </button>
            <p>Page {page} of {issues.data.pageCount}</p>
            <button
              className="secondary-button"
              type="button"
              disabled={page >= issues.data.pageCount}
              onClick={() => {
                setPage((value) => value + 1)
              }}
            >
              Next
            </button>
          </nav>
        ) : null}
      </section>

      <ProjectMembershipPanel
        projectId={project.id}
        canManage={authorization.can('members:manage')}
      />

      <ProjectWorkflowPanel
        projectId={project.id}
        canManage={authorization.can('project:update', project.id)}
      />

      <ProjectActivityPanel
        activity={activity}
        page={activityPage}
        onPageChange={setActivityPage}
      />

      {activeAction === 'edit' ? (
        <ProjectEditDialog
          project={project}
          onClose={() => {
            setActionSession(null)
          }}
        />
      ) : null}
      {transferringLead ? (
        <ProjectLeadTransferDialog
          projectId={project.id}
          authorized={canTransferLead}
          onClose={() => {
            setTransferringLead(false)
          }}
          onTransferred={(message) => {
            setAnnouncement(message)
            setTransferringLead(false)
          }}
        />
      ) : null}
      {activeAction === 'archive' ? (
        <ArchiveProjectDialog
          project={project}
          onClose={() => {
            setActionSession(null)
          }}
        />
      ) : null}
    </section>
  )
}

function ProjectWatchPanel({
  project,
  subscription,
  canSubscribe,
}: Readonly<{
  project: Project
  subscription: ReturnType<typeof useProjectSubscriptionData>
  canSubscribe: boolean
}>) {
  const update = useSetProjectSubscription(project.id)
  const [status, setStatus] = useState('')
  const mutationInFlight = useRef(false)

  return (
    <section className="work-panel project-watchers" aria-labelledby="project-watchers-title">
      <div className="project-watchers__introduction">
        <p className="page-eyebrow">Collaboration</p>
        <h2 id="project-watchers-title">Project watchers</h2>
        <p>Watch this project to receive lifecycle and workflow notifications.</p>
      </div>
      {subscription.isPending ? (
        <p role="status">Loading project watchers…</p>
      ) : subscription.isError ? (
        <div className="project-watchers__error" role="alert">
          <span>Project watchers could not be loaded.</span>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void subscription.refetch()}
          >
            Retry project watchers
          </button>
        </div>
      ) : (
        <>
          <div className="project-watchers__summary">
            <p>
              {subscription.data.subscribers.length.toString()}{' '}
              {subscription.data.subscribers.length === 1 ? 'watcher' : 'watchers'}
            </p>
            {canSubscribe &&
            (project.status !== 'archived' || subscription.data.subscribed) ? (
              <button
                className="secondary-button"
                type="button"
                aria-pressed={subscription.data.subscribed}
                aria-disabled={update.isPending}
                onClick={() => {
                  if (mutationInFlight.current) return
                  mutationInFlight.current = true
                  const subscribed = !subscription.data.subscribed
                  setStatus('')
                  update.mutate(
                    {
                      projectId: project.id,
                      expectedSubscribed: subscription.data.subscribed,
                      subscribed,
                    },
                    {
                      onSuccess: () => {
                        setStatus(
                          subscribed
                            ? 'You are now watching this project.'
                            : 'You stopped watching this project.',
                        )
                      },
                      onError: (error) => {
                        setStatus(
                          hasAppErrorKind(error, 'conflict')
                            ? 'Watch state changed in another session. Current state restored.'
                            : 'Watch state could not be updated. Previous state restored.',
                        )
                      },
                      onSettled: () => {
                        mutationInFlight.current = false
                      },
                    },
                  )
                }}
              >
                {update.isPending
                  ? 'Updating…'
                  : subscription.data.subscribed
                    ? 'Stop watching project'
                    : 'Watch project'}
              </button>
            ) : project.status === 'archived' ? (
              <p className="project-watchers__unavailable">
                Archived projects cannot gain new watchers.
              </p>
            ) : null}
          </div>
          {subscription.data.subscribers.length > 0 ? (
            <ul
              className="project-watchers__list"
              aria-label="People watching this project"
            >
              {subscription.data.subscribers.map((subscriber) => (
                <li key={subscriber.id}>{subscriber.displayName}</li>
              ))}
            </ul>
          ) : (
            <p className="project-watchers__empty">No one is watching yet.</p>
          )}
        </>
      )}
      {status ? <p className="project-watchers__status" role="status">{status}</p> : null}
    </section>
  )
}

function ProjectActivityPanel({
  activity,
  page,
  onPageChange,
}: Readonly<{
  activity: ReturnType<typeof useProjectActivity>
  page: number
  onPageChange: (page: number) => void
}>) {
  return (
    <section className="work-panel" aria-labelledby="project-activity-title">
      <div className="work-panel__header">
        <div>
          <p className="page-eyebrow">Change record</p>
          <h2 id="project-activity-title">Project activity</h2>
        </div>
      </div>
      {activity.isPending ? (
        <div className="dashboard-state" role="status">
          Loading project activity…
        </div>
      ) : activity.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <p>Project activity could not be loaded.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void activity.refetch()}
          >
            Retry activity
          </button>
        </div>
      ) : activity.data.events.items.length === 0 ? (
        <p className="project-activity-empty">No project changes recorded yet.</p>
      ) : (
        <>
          <ol className="project-activity-list">
            {activity.data.events.items.map(({ actor, event }) => (
              <li key={event.id}>
                <p>
                  <strong>{actor.displayName}</strong> {event.summary}
                </p>
                <time dateTime={event.occurredAt}>
                  {formatTimestamp(event.occurredAt)}
                </time>
              </li>
            ))}
          </ol>
          {activity.data.events.pageCount > 1 ? (
            <nav className="project-pagination" aria-label="Project activity pagination">
              <button
                className="secondary-button"
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  onPageChange(page - 1)
                }}
              >
                Previous
              </button>
              <p>Page {page} of {activity.data.events.pageCount}</p>
              <button
                className="secondary-button"
                type="button"
                disabled={page >= activity.data.events.pageCount}
                onClick={() => {
                  onPageChange(page + 1)
                }}
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      )}
    </section>
  )
}

function ProjectEditDialog({
  project,
  onClose,
}: Readonly<{
  project: Project
  onClose: () => void
}>) {
  const update = useUpdateProject(project.id)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [status, setStatus] = useState(project.status)
  const [validationError, setValidationError] = useState<string | null>(null)

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const normalizedName = name.trim()
    if (normalizedName.length === 0 || normalizedName.length > 120) {
      setValidationError('Project names must contain 1 to 120 characters.')
      return
    }
    if (description.trim().length > 5_000) {
      setValidationError('Project descriptions may not exceed 5,000 characters.')
      return
    }
    setValidationError(null)
    const changes: Partial<MutableProjectFields> = {
      name: normalizedName,
      description: description.trim(),
      status,
    }
    update.mutate({ project, changes }, { onSuccess: onClose })
  }

  const message = validationError ?? gatewayMessage(update.error)
  return (
    <ModalDialog
      titleId="project-edit-title"
      descriptionId="project-edit-description"
      onRequestClose={() => {
        if (!update.isPending) onClose()
      }}
    >
      <form className="project-lifecycle-form" onSubmit={submit}>
        <h2 id="project-edit-title">Edit project</h2>
        <p id="project-edit-description">
          Update governed project details. The project key remains immutable.
        </p>
        {message ? (
          <p className="form-error" role="alert">{message}</p>
        ) : null}
        <label>
          <span>Name</span>
          <input
            value={name}
            maxLength={120}
            onChange={(event) => {
              setName(event.currentTarget.value)
            }}
          />
        </label>
        <label>
          <span>Description</span>
          <textarea
            value={description}
            maxLength={5_000}
            rows={5}
            onChange={(event) => {
              setDescription(event.currentTarget.value)
            }}
          />
        </label>
        <label>
          <span>Status</span>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.currentTarget.value as ProjectStatus)
            }}
          >
            {allowedStatuses[project.status].map((candidate) => (
              <option key={candidate} value={candidate}>
                {formatStatus(candidate)}
              </option>
            ))}
          </select>
        </label>
        <div className="project-lifecycle-form__actions">
          <button className="secondary-button" type="button" disabled={update.isPending} onClick={onClose}>
            Cancel
          </button>
          <button className="primary-button" type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save project'}
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

function ArchiveProjectDialog({
  project,
  onClose,
}: Readonly<{ project: Project; onClose: () => void }>) {
  const archive = useArchiveProject(project.id)
  return (
    <ModalDialog
      titleId="archive-project-title"
      descriptionId="archive-project-description"
      onRequestClose={() => {
        if (!archive.isPending) onClose()
      }}
    >
      <div className="project-lifecycle-form">
        <h2 id="archive-project-title">Archive {project.name}?</h2>
        <p id="archive-project-description">
          Existing work remains visible, but issues and comments become read-only.
        </p>
        {archive.error ? (
          <p className="form-error" role="alert">{gatewayMessage(archive.error)}</p>
        ) : null}
        <div className="project-lifecycle-form__actions">
          <button className="secondary-button" type="button" disabled={archive.isPending} onClick={onClose}>
            Cancel
          </button>
          <button
            className="danger-button"
            type="button"
            disabled={archive.isPending}
            onClick={() => {
              archive.mutate(project, { onSuccess: onClose })
            }}
          >
            {archive.isPending ? 'Archiving…' : 'Archive project'}
          </button>
        </div>
      </div>
    </ModalDialog>
  )
}

function ProjectLoading() {
  return (
    <section className="page" aria-labelledby="project-detail-title" aria-busy="true">
      <ProjectDetailHeader title="Project" />
      <div className="dashboard-state" role="status">Loading project…</div>
    </section>
  )
}

function ProjectNotFound() {
  return (
    <section className="page" aria-labelledby="project-detail-title">
      <ProjectDetailHeader title="Project not found" />
      <div className="empty-panel">
        <p className="empty-panel__status">Unknown project</p>
        <p>The requested project does not exist in this workspace.</p>
        <Link className="text-link" to="/projects">Return to projects</Link>
      </div>
    </section>
  )
}

function ProjectDetailHeader({ title }: Readonly<{ title: string }>) {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace project</p>
      <h1 id="project-detail-title">{title}</h1>
    </header>
  )
}

function gatewayMessage(error: Error | null): string | null {
  if (!error) return null
  if (hasAppErrorKind(error, 'conflict')) {
    return `${error.message} Your draft is preserved.`
  }
  return error.message
}

function formatStatus(status: ProjectStatus): string {
  return status.charAt(0).toLocaleUpperCase() + status.slice(1)
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}

function parseProjectId(value: string | undefined): ProjectId | null {
  if (!value) return null
  try {
    return projectId(value)
  } catch {
    return null
  }
}
