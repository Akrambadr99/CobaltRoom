import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type { IssueCreationMetadata } from '../../data'
import {
  type IssuePriority,
  type IssueType,
  type LabelId,
} from '../../domain'
import { useAppServices } from '../../app/providers/app-services-context'
import {
  createInitialIssueDraft,
  validateIssueCreateDraft,
  type IssueCreateDraft,
} from './issue-form'
import { useCreateIssue, useIssueCreationMetadata } from './issue-queries'

const issueTypes: readonly IssueType[] = ['task', 'bug', 'story']
const issuePriorities: readonly IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]

export function IssueCreateDialog({
  onClose,
}: Readonly<{ onClose: () => void }>) {
  const metadata = useIssueCreationMetadata(true)
  const createIssue = useCreateIssue()

  return (
    <ModalDialog
      titleId="issue-create-title"
      descriptionId="issue-create-description"
      onRequestClose={() => {
        if (!createIssue.isPending) onClose()
      }}
    >
      {metadata.isPending ? (
        <IssueCreateState message="Loading issue fields…" onClose={onClose} />
      ) : metadata.isError ? (
        <div className="issue-edit-form">
          <IssueCreateHeading />
          <p className="form-error" role="alert">
            Issue fields could not be loaded.
          </p>
          <div className="issue-edit-form__actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => void metadata.refetch()}
            >
              Retry fields
            </button>
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      ) : metadata.data.projects.length === 0 ? (
        <IssueCreateState
          message="You do not have access to create issues in an active project."
          onClose={onClose}
        />
      ) : (
        <IssueCreateForm
          metadata={metadata.data}
          createIssue={createIssue}
          onClose={onClose}
        />
      )}
    </ModalDialog>
  )
}

function IssueCreateForm({
  metadata,
  createIssue,
  onClose,
}: Readonly<{
  metadata: IssueCreationMetadata
  createIssue: ReturnType<typeof useCreateIssue>
  onClose: () => void
}>) {
  const { workspaceId } = useAppServices()
  const navigate = useNavigate()
  const projectFieldRef = useRef<HTMLSelectElement>(null)
  const [draft, setDraft] = useState<IssueCreateDraft>(() =>
    createInitialIssueDraft(metadata),
  )
  const [errors, setErrors] = useState<
    ReturnType<typeof validateIssueCreateDraft>['errors']
  >({})
  const [submitError, setSubmitError] = useState('')
  const projectMetadata = metadata.projects.find(
    ({ project }) => project.id === draft.projectId,
  )

  useEffect(() => {
    projectFieldRef.current?.focus()
  }, [])

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const validation = validateIssueCreateDraft(draft, metadata, workspaceId)
    setErrors(validation.errors)
    setSubmitError('')
    if (!validation.input) return

    createIssue.mutate(validation.input, {
      onSuccess: (issue) => {
        onClose()
        void navigate(`/issues/${issue.id}`)
      },
      onError: (error) => {
        setSubmitError(error.message)
      },
    })
  }

  const toggleLabel = (labelId: LabelId, checked: boolean) => {
    setDraft((current) => ({
      ...current,
      labelIds: checked
        ? [...current.labelIds, labelId]
        : current.labelIds.filter((id) => id !== labelId),
    }))
  }

  return (
    <form className="issue-edit-form" onSubmit={handleSubmit} noValidate>
      <IssueCreateHeading />
      <div className="issue-edit-form__row">
        <FormField label="Project" error={errors.projectId} errorId="project-error">
          <select
            ref={projectFieldRef}
            value={draft.projectId ?? ''}
            aria-invalid={Boolean(errors.projectId)}
            aria-describedby={errors.projectId ? 'project-error' : undefined}
            onChange={(event) => {
              const selected = metadata.projects.find(
                ({ project }) => project.id === event.currentTarget.value,
              )
              if (!selected) return
              setDraft({
                ...draft,
                projectId: selected.project.id,
                statusId: selected.statuses[0]?.id ?? null,
                assigneeId: null,
              })
            }}
          >
            {metadata.projects.map(({ project }) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Type">
          <select
            value={draft.type}
            onChange={(event) => {
              const type = issueTypes.find(
                (candidate) => candidate === event.currentTarget.value,
              )
              if (type) setDraft({ ...draft, type })
            }}
          >
            {issueTypes.map((type) => (
              <option key={type} value={type}>
                {capitalize(type)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <FormField label="Title" error={errors.title} errorId="title-error">
        <input
          value={draft.title}
          maxLength={161}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={errors.title ? 'title-error' : undefined}
          onChange={(event) => {
            setDraft({ ...draft, title: event.currentTarget.value })
          }}
        />
      </FormField>
      <FormField
        label="Description"
        error={errors.description}
        errorId="description-error"
      >
        <textarea
          value={draft.description}
          rows={5}
          maxLength={5_001}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'description-error' : undefined}
          onChange={(event) => {
            setDraft({ ...draft, description: event.currentTarget.value })
          }}
        />
      </FormField>
      <div className="issue-edit-form__row">
        <FormField label="Status" error={errors.statusId} errorId="status-error">
          <select
            value={draft.statusId ?? ''}
            aria-invalid={Boolean(errors.statusId)}
            aria-describedby={errors.statusId ? 'status-error' : undefined}
            onChange={(event) => {
              const status = projectMetadata?.statuses.find(
                ({ id }) => id === event.currentTarget.value,
              )
              if (status) setDraft({ ...draft, statusId: status.id })
            }}
          >
            {projectMetadata?.statuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Priority">
          <select
            value={draft.priority}
            onChange={(event) => {
              const priority = issuePriorities.find(
                (candidate) => candidate === event.currentTarget.value,
              )
              if (priority) setDraft({ ...draft, priority })
            }}
          >
            {issuePriorities.map((priority) => (
              <option key={priority} value={priority}>
                {capitalize(priority)}
              </option>
            ))}
          </select>
        </FormField>
      </div>
      <div className="issue-edit-form__row">
        <FormField
          label="Assignee"
          error={errors.assigneeId}
          errorId="assignee-error"
        >
          <select
            value={draft.assigneeId ?? ''}
            aria-invalid={Boolean(errors.assigneeId)}
            aria-describedby={errors.assigneeId ? 'assignee-error' : undefined}
            onChange={(event) => {
              const assignee = projectMetadata?.assignees.find(
                ({ id }) => id === event.currentTarget.value,
              )
              setDraft({ ...draft, assigneeId: assignee?.id ?? null })
            }}
          >
            <option value="">Unassigned</option>
            {projectMetadata?.assignees.map((assignee) => (
              <option key={assignee.id} value={assignee.id}>
                {assignee.displayName}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Due date" error={errors.dueDate} errorId="due-error">
          <input
            type="date"
            value={draft.dueDate}
            aria-invalid={Boolean(errors.dueDate)}
            aria-describedby={errors.dueDate ? 'due-error' : undefined}
            onChange={(event) => {
              setDraft({ ...draft, dueDate: event.currentTarget.value })
            }}
          />
        </FormField>
      </div>
      <fieldset className="issue-label-fieldset">
        <legend>Labels</legend>
        {metadata.labels.length === 0 ? (
          <p>No workspace labels are available.</p>
        ) : (
          <div className="issue-label-options">
            {metadata.labels.map((label) => (
              <label key={label.id}>
                <input
                  type="checkbox"
                  checked={draft.labelIds.includes(label.id)}
                  onChange={(event) => {
                    toggleLabel(label.id, event.currentTarget.checked)
                  }}
                />
                <span aria-hidden="true" style={{ background: label.color }} />
                {label.name}
              </label>
            ))}
          </div>
        )}
        {errors.labelIds ? (
          <span className="form-field__error">{errors.labelIds}</span>
        ) : null}
      </fieldset>
      {submitError ? (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="issue-edit-form__actions">
        <button
          className="primary-button"
          type="submit"
          disabled={createIssue.isPending}
        >
          {createIssue.isPending ? 'Creating…' : 'Create issue'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={createIssue.isPending}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function IssueCreateHeading() {
  return (
    <div>
      <p className="page-eyebrow">New workspace issue</p>
      <h2 id="issue-create-title">Create issue</h2>
      <p id="issue-create-description">
        Capture work in a project workflow with clear ownership and priority.
      </p>
    </div>
  )
}

function IssueCreateState({
  message,
  onClose,
}: Readonly<{ message: string; onClose: () => void }>) {
  return (
    <div className="issue-edit-form">
      <IssueCreateHeading />
      <p role="status">{message}</p>
      <div className="issue-edit-form__actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function FormField({
  label,
  error,
  errorId,
  children,
}: Readonly<{
  label: string
  error?: string | undefined
  errorId?: string | undefined
  children: ReactElement
}>) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {error ? (
        <span className="form-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  )
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
