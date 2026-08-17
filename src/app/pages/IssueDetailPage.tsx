import { useState, type ReactElement, type SyntheticEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import { GatewayConflictError } from '../../data'
import {
  issueId,
  type Issue,
  type IssueId,
  type IssuePriority,
} from '../../domain'
import {
  useIssueDetailData,
  useOptimisticIssueUpdate,
} from '../../features/issues/issue-detail-queries'
import {
  validateIssueEditDraft,
  type IssueEditDraft,
} from '../../features/issues/issue-form'
import { useAppServices } from '../providers/app-services-context'
import './issues-page.css'
import './pages.css'

const priorities: readonly IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]

export function IssueDetailPage() {
  const requestedIssueId = parseIssueId(useParams<{ issueId: string }>().issueId)
  return requestedIssueId ? (
    <LoadedIssue requestedIssueId={requestedIssueId} />
  ) : (
    <IssueNotFound />
  )
}

function LoadedIssue({ requestedIssueId }: Readonly<{ requestedIssueId: IssueId }>) {
  const services = useAppServices()
  const { issue, projects } = useIssueDetailData(requestedIssueId)
  const [editing, setEditing] = useState(false)
  const [status, setStatus] = useState('')

  if (issue.isPending || projects.isPending) {
    return <IssueState role="status" message="Loading issue…" />
  }

  if (issue.isError || projects.isError) {
    const issueError = issue.error
    const notFound =
      issueError !== null && 'code' in issueError && issueError.code === 'not-found'
    if (notFound) return <IssueNotFound />

    return (
      <section className="page" aria-labelledby="issue-detail-title">
        <IssueHeader title="Issue unavailable" />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <p>The local service could not load this issue.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void Promise.all([issue.refetch(), projects.refetch()])}
          >
            Retry issue
          </button>
        </div>
      </section>
    )
  }

  const project = projects.data.find(({ id }) => id === issue.data.projectId)
  const canEdit = services.can('issue:update', issue.data.projectId)

  return (
    <section className="page" aria-labelledby="issue-detail-title">
      <header className="issue-detail-header">
        <Link className="text-link" to="/issues">
          ← Issues
        </Link>
        <div>
          <p className="page-eyebrow">
            {project?.key ?? 'Issue'}-{issue.data.number} · Revision {issue.data.revision}
          </p>
          <h1 id="issue-detail-title">{issue.data.title}</h1>
          <p>{issue.data.description || 'No description provided.'}</p>
        </div>
        {canEdit ? (
          <button
            className="primary-button"
            type="button"
            onClick={() => {
              setStatus('')
              setEditing(true)
            }}
          >
            Edit issue
          </button>
        ) : (
          <p className="page-eyebrow">Read-only access</p>
        )}
      </header>

      {status ? (
        <p className="bulk-status" role="status">
          {status}
        </p>
      ) : null}

      <dl className="issue-detail-grid">
        <div>
          <dt>Project</dt>
          <dd>{project?.name ?? 'Unknown project'}</dd>
        </div>
        <div>
          <dt>Priority</dt>
          <dd>{capitalize(issue.data.priority)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{capitalize(issue.data.type)}</dd>
        </div>
        <div>
          <dt>Due date</dt>
          <dd>{issue.data.dueDate ?? 'Not scheduled'}</dd>
        </div>
      </dl>

      {editing ? (
        <IssueEditDialog
          issue={issue.data}
          onClose={() => {
            setEditing(false)
          }}
          onSaved={() => {
            setEditing(false)
            setStatus('Issue changes saved.')
          }}
        />
      ) : null}
    </section>
  )
}

function IssueEditDialog({
  issue,
  onClose,
  onSaved,
}: Readonly<{ issue: Issue; onClose: () => void; onSaved: () => void }>) {
  const update = useOptimisticIssueUpdate(issue.id)
  const [draft, setDraft] = useState<IssueEditDraft>(() => ({
    title: issue.title,
    description: issue.description,
    priority: issue.priority,
    dueDate: issue.dueDate ?? '',
  }))
  const [errors, setErrors] = useState<
    ReturnType<typeof validateIssueEditDraft>['errors']
  >({})
  const [submitError, setSubmitError] = useState('')

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateIssueEditDraft(draft)
    setErrors(validation.errors)
    setSubmitError('')
    if (!validation.changes) return

    update.mutate(
      { issue, changes: validation.changes },
      {
        onSuccess: onSaved,
        onError: (error) => {
          setSubmitError(
            error instanceof GatewayConflictError
              ? 'This issue changed elsewhere. The latest revision is loaded; review your draft and retry.'
              : error.message,
          )
        },
      },
    )
  }

  return (
    <ModalDialog
      titleId="issue-edit-title"
      descriptionId="issue-edit-description"
      onRequestClose={onClose}
    >
      <form className="issue-edit-form" onSubmit={handleSubmit} noValidate>
        <div>
          <p className="page-eyebrow">Issue editor</p>
          <h2 id="issue-edit-title">Edit issue</h2>
          <p id="issue-edit-description">
            Update the issue without losing concurrent changes.
          </p>
        </div>
        <FormField label="Title" error={errors.title}>
          <input
            aria-invalid={Boolean(errors.title)}
            value={draft.title}
            maxLength={161}
            onChange={(event) => {
              setDraft({ ...draft, title: event.currentTarget.value })
            }}
          />
        </FormField>
        <FormField label="Description" error={errors.description}>
          <textarea
            aria-invalid={Boolean(errors.description)}
            value={draft.description}
            rows={5}
            onChange={(event) => {
              setDraft({ ...draft, description: event.currentTarget.value })
            }}
          />
        </FormField>
        <div className="issue-edit-form__row">
          <FormField label="Priority">
            <select
              value={draft.priority}
              onChange={(event) => {
                const priority = priorities.find(
                  (candidate) => candidate === event.currentTarget.value,
                )
                if (priority) setDraft({ ...draft, priority })
              }}
            >
              {priorities.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Due date" error={errors.dueDate}>
            <input
              type="date"
              aria-invalid={Boolean(errors.dueDate)}
              value={draft.dueDate}
              onChange={(event) => {
                setDraft({ ...draft, dueDate: event.currentTarget.value })
              }}
            />
          </FormField>
        </div>
        {submitError ? (
          <p className="form-error" role="alert">
            {submitError}
          </p>
        ) : null}
        <div className="issue-edit-form__actions">
          <button className="primary-button" type="submit" disabled={update.isPending}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={update.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </form>
    </ModalDialog>
  )
}

function FormField({
  label,
  error,
  children,
}: Readonly<{
  label: string
  error?: string | undefined
  children: ReactElement
}>) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error ? <span className="form-field__error">{error}</span> : null}
    </label>
  )
}

function IssueState({ role, message }: Readonly<{ role: 'status'; message: string }>) {
  return (
    <section className="page">
      <IssueHeader title="Issue" />
      <div className="dashboard-state" role={role}>
        {message}
      </div>
    </section>
  )
}

function IssueNotFound() {
  return (
    <section className="page">
      <IssueHeader title="Issue not found" />
      <div className="empty-panel">
        <p>The requested issue does not exist.</p>
        <Link className="text-link" to="/issues">
          Return to issues
        </Link>
      </div>
    </section>
  )
}

function IssueHeader({ title }: Readonly<{ title: string }>) {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace issue</p>
      <h1 id="issue-detail-title">{title}</h1>
    </header>
  )
}

function parseIssueId(value: string | undefined): IssueId | null {
  if (!value) return null
  try {
    return issueId(value)
  } catch {
    return null
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
