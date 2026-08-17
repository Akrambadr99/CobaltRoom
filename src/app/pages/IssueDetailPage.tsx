import {
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { Link, useParams } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import { GatewayConflictError } from '../../data'
import { CommentItem } from '../../features/comments/CommentItem'
import {
  issueId,
  type Issue,
  type IssueId,
  type IssuePriority,
} from '../../domain'
import {
  useIssueDetailData,
  useIssueActivityData,
  useCreateIssueComment,
  useOptimisticIssueUpdate,
} from '../../features/issues/issue-detail-queries'
import {
  validateIssueEditDraft,
  type IssueEditDraft,
} from '../../features/issues/issue-form'
import { useAuthorization } from '../providers/authorization-context'
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
  const authorization = useAuthorization()
  const { issue, projects } = useIssueDetailData(requestedIssueId)
  const activity = useIssueActivityData(requestedIssueId)
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
  const canEdit = authorization.can('issue:update', issue.data.projectId)

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

      <IssueCollaboration
        issue={issue.data}
        activity={activity}
        canComment={authorization.can('comment:create', issue.data.projectId)}
      />

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

function IssueCollaboration({
  issue,
  activity,
  canComment,
}: Readonly<{
  issue: Issue
  activity: ReturnType<typeof useIssueActivityData>
  canComment: boolean
}>) {
  if (activity.isPending) {
    return (
      <section className="issue-collaboration" aria-label="Issue collaboration">
        <div className="dashboard-state" role="status">
          Loading comments and activity…
        </div>
      </section>
    )
  }

  if (activity.isError) {
    return (
      <section className="issue-collaboration" aria-label="Issue collaboration">
        <div className="dashboard-state dashboard-state--error" role="alert">
          <p>Comments and activity could not be loaded.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void activity.refetch()}
          >
            Retry history
          </button>
        </div>
      </section>
    )
  }

  const usersById = new Map(activity.data.users.map((user) => [user.id, user]))

  return (
    <section className="issue-collaboration" aria-label="Issue collaboration">
      <div className="issue-collaboration__column">
        <header>
          <p className="page-eyebrow">Discussion</p>
          <h2>Comments</h2>
        </header>
        {canComment ? <CommentForm issueId={issue.id} /> : null}
        {activity.data.comments.length === 0 ? (
          <p className="issue-collaboration__empty">No comments yet.</p>
        ) : (
          <ol className="comment-list">
            {activity.data.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                issueId={issue.id}
                projectId={issue.projectId}
                comment={comment}
                authorName={
                  usersById.get(comment.authorId)?.displayName ?? 'Unknown member'
                }
                deletedByName={
                  comment.deletedById
                    ? (usersById.get(comment.deletedById)?.displayName ??
                      'Unknown moderator')
                    : null
                }
              />
            ))}
          </ol>
        )}
      </div>
      <div className="issue-collaboration__column">
        <header>
          <p className="page-eyebrow">Record</p>
          <h2>Activity</h2>
        </header>
        {activity.data.activityEvents.length === 0 ? (
          <p className="issue-collaboration__empty">No activity recorded yet.</p>
        ) : (
          <ol className="activity-list">
            {activity.data.activityEvents.map((event) => (
              <li key={event.id}>
                <span className="activity-list__marker" aria-hidden="true" />
                <div>
                  <p>
                    <strong>
                      {usersById.get(event.actorId)?.displayName ?? 'Unknown member'}
                    </strong>{' '}
                    {event.summary}
                  </p>
                  <time dateTime={event.occurredAt}>
                    {formatTimestamp(event.occurredAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  )
}

function CommentForm({ issueId }: Readonly<{ issueId: IssueId }>) {
  const createComment = useCreateIssueComment(issueId)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)
  const [body, setBody] = useState('')
  const [validationError, setValidationError] = useState('')
  const [status, setStatus] = useState('')

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const normalized = body.trim()
    setStatus('')
    if (normalized.length === 0 || normalized.length > 5_000) {
      setValidationError('Enter a comment between 1 and 5,000 characters.')
      return
    }

    setValidationError('')
    createComment.mutate(normalized, {
      onSuccess: () => {
        setBody('')
        setStatus('Comment added.')
        textAreaRef.current?.focus()
      },
    })
  }

  return (
    <form className="comment-form" aria-label="Add comment" onSubmit={handleSubmit}>
      <label htmlFor="new-comment">Add a comment</label>
      <textarea
        ref={textAreaRef}
        id="new-comment"
        rows={4}
        maxLength={5_001}
        value={body}
        aria-invalid={Boolean(validationError)}
        aria-describedby="comment-guidance"
        onChange={(event) => {
          setBody(event.currentTarget.value)
        }}
      />
      <div className="comment-form__footer">
        <p id="comment-guidance">
          {validationError || `${body.length.toString()} of 5,000 characters`}
        </p>
        <button
          className="primary-button"
          type="submit"
          disabled={createComment.isPending}
        >
          {createComment.isPending ? 'Adding…' : 'Add comment'}
        </button>
      </div>
      {createComment.isError ? (
        <p className="form-error" role="alert">
          {createComment.error.message}
        </p>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
    </form>
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

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
