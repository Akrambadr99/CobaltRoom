import {
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type SyntheticEvent,
} from 'react'
import { useNavigate } from 'react-router-dom'

import { useAppServices } from '../../app/providers/app-services-context'
import { ModalDialog } from '../../components/dialog/ModalDialog'
import type { CreateProjectInput, ProjectCreationMetadata } from '../../data'
import type { UserId, WorkflowStatusCategory } from '../../domain'
import {
  useCreateProject,
  useProjectCreationMetadata,
} from './project-queries'

interface ProjectDraft {
  readonly key: string
  readonly name: string
  readonly description: string
  readonly leadId: UserId | null
  readonly workflow: readonly {
    readonly name: string
    readonly category: WorkflowStatusCategory
  }[]
}

type ProjectDraftErrors = Partial<
  Record<'description' | 'key' | 'leadId' | 'name' | 'workflow', string>
>

const initialWorkflow = [
  { name: 'Backlog', category: 'backlog' },
  { name: 'In progress', category: 'started' },
  { name: 'Done', category: 'completed' },
] as const satisfies ProjectDraft['workflow']

const categories: readonly WorkflowStatusCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

export function ProjectCreateDialog({ onClose }: Readonly<{ onClose: () => void }>) {
  const metadata = useProjectCreationMetadata(true)
  const createProject = useCreateProject()

  return (
    <ModalDialog
      titleId="project-create-title"
      descriptionId="project-create-description"
      onRequestClose={() => {
        if (!createProject.isPending) onClose()
      }}
    >
      {metadata.isPending ? (
        <ProjectCreateState message="Loading project fields…" onClose={onClose} />
      ) : metadata.isError ? (
        <div className="project-create-form">
          <ProjectCreateHeading />
          <p className="form-error" role="alert">
            Project fields could not be loaded.
          </p>
          <div className="project-create-form__actions">
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
      ) : metadata.data.eligibleLeads.length === 0 ? (
        <ProjectCreateState
          message="No active workspace members are eligible to lead a project."
          onClose={onClose}
        />
      ) : (
        <ProjectCreateForm
          metadata={metadata.data}
          createProject={createProject}
          onClose={onClose}
        />
      )}
    </ModalDialog>
  )
}

function ProjectCreateForm({
  metadata,
  createProject,
  onClose,
}: Readonly<{
  metadata: ProjectCreationMetadata
  createProject: ReturnType<typeof useCreateProject>
  onClose: () => void
}>) {
  const { workspaceId } = useAppServices()
  const navigate = useNavigate()
  const nameField = useRef<HTMLInputElement>(null)
  const submissionPending = useRef(false)
  const [draft, setDraft] = useState<ProjectDraft>({
    key: '',
    name: '',
    description: '',
    leadId: metadata.eligibleLeads[0]?.id ?? null,
    workflow: initialWorkflow,
  })
  const [errors, setErrors] = useState<ProjectDraftErrors>({})
  const [submitError, setSubmitError] = useState('')

  useEffect(() => {
    nameField.current?.focus()
  }, [])

  const updateWorkflow = (
    index: number,
    changes: Partial<ProjectDraft['workflow'][number]>,
  ) => {
    setDraft((current) => ({
      ...current,
      workflow: current.workflow.map((status, statusIndex) =>
        statusIndex === index ? { ...status, ...changes } : status,
      ),
    }))
  }

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submissionPending.current) return
    const validation = validateProjectDraft(draft, workspaceId)
    setErrors(validation.errors)
    setSubmitError('')
    if (!validation.input) return

    submissionPending.current = true
    createProject.mutate(validation.input, {
      onSuccess: (project) => {
        onClose()
        void navigate(`/projects/${project.id}`)
      },
      onError: (error) => {
        setSubmitError(error.message)
      },
      onSettled: () => {
        submissionPending.current = false
      },
    })
  }

  return (
    <form className="project-create-form" onSubmit={handleSubmit} noValidate>
      <ProjectCreateHeading />
      <div className="project-create-form__row">
        <ProjectField label="Name" error={errors.name} errorId="project-name-error">
          <input
            ref={nameField}
            value={draft.name}
            maxLength={121}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'project-name-error' : undefined}
            onChange={(event) => {
              setDraft({ ...draft, name: event.currentTarget.value })
            }}
          />
        </ProjectField>
        <ProjectField label="Key" error={errors.key} errorId="project-key-error">
          <input
            value={draft.key}
            maxLength={10}
            autoCapitalize="characters"
            aria-invalid={Boolean(errors.key)}
            aria-describedby={errors.key ? 'project-key-error' : undefined}
            onChange={(event) => {
              setDraft({ ...draft, key: event.currentTarget.value.toLocaleUpperCase() })
            }}
          />
        </ProjectField>
      </div>
      <ProjectField
        label="Description"
        error={errors.description}
        errorId="project-description-error"
      >
        <textarea
          value={draft.description}
          rows={4}
          maxLength={5_001}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={errors.description ? 'project-description-error' : undefined}
          onChange={(event) => {
            setDraft({ ...draft, description: event.currentTarget.value })
          }}
        />
      </ProjectField>
      <ProjectField label="Project lead" error={errors.leadId} errorId="project-lead-error">
        <select
          value={draft.leadId ?? ''}
          aria-invalid={Boolean(errors.leadId)}
          aria-describedby={errors.leadId ? 'project-lead-error' : undefined}
          onChange={(event) => {
            const lead = metadata.eligibleLeads.find(
              ({ id }) => id === event.currentTarget.value,
            )
            setDraft({ ...draft, leadId: lead?.id ?? null })
          }}
        >
          {metadata.eligibleLeads.map((lead) => (
            <option key={lead.id} value={lead.id}>
              {lead.displayName}
            </option>
          ))}
        </select>
      </ProjectField>
      <fieldset
        className="project-workflow-fields"
        aria-invalid={Boolean(errors.workflow)}
        aria-describedby={errors.workflow ? 'project-workflow-error' : undefined}
      >
        <legend>Initial workflow</legend>
        <p>Define the ordered stages used when work is first created.</p>
        {draft.workflow.map((status, index) => (
          <div className="project-create-form__row" key={index}>
            <ProjectField label={`Stage ${String(index + 1)} name`}>
              <input
                value={status.name}
                maxLength={61}
                onChange={(event) => {
                  updateWorkflow(index, { name: event.currentTarget.value })
                }}
              />
            </ProjectField>
            <ProjectField label={`Stage ${String(index + 1)} category`}>
              <select
                value={status.category}
                onChange={(event) => {
                  const category = categories.find(
                    (candidate) => candidate === event.currentTarget.value,
                  )
                  if (category) updateWorkflow(index, { category })
                }}
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {formatCategory(category)}
                  </option>
                ))}
              </select>
            </ProjectField>
          </div>
        ))}
        {errors.workflow ? (
          <span className="form-field__error" id="project-workflow-error">
            {errors.workflow}
          </span>
        ) : null}
      </fieldset>
      {submitError ? (
        <p className="form-error" role="alert">
          {submitError}
        </p>
      ) : null}
      <div className="project-create-form__actions">
        <button className="primary-button" type="submit" disabled={createProject.isPending}>
          {createProject.isPending ? 'Creating…' : 'Create project'}
        </button>
        <button
          className="secondary-button"
          type="button"
          disabled={createProject.isPending}
          onClick={onClose}
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

function validateProjectDraft(
  draft: ProjectDraft,
  workspaceId: CreateProjectInput['workspaceId'],
): { readonly errors: ProjectDraftErrors; readonly input?: CreateProjectInput } {
  const errors: ProjectDraftErrors = {}
  const name = draft.name.trim()
  const key = draft.key.trim().toLocaleUpperCase()
  const description = draft.description.trim()
  const workflowNames = new Set(
    draft.workflow.map((status) => status.name.trim().toLocaleLowerCase()),
  )

  if (name.length === 0 || name.length > 120) {
    errors.name = 'Enter a project name containing 1 to 120 characters.'
  }
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(key)) {
    errors.key = 'Use 2-10 uppercase letters or digits, beginning with a letter.'
  }
  if (description.length > 5_000) {
    errors.description = 'Descriptions may not exceed 5,000 characters.'
  }
  if (!draft.leadId) errors.leadId = 'Choose an active project lead.'
  if (
    draft.workflow.some(
      (status) => status.name.trim().length === 0 || status.name.trim().length > 60,
    ) ||
    workflowNames.size !== draft.workflow.length ||
    !draft.workflow.some(({ category }) => category === 'completed') ||
    !draft.workflow.some(
      ({ category }) => category !== 'completed' && category !== 'canceled',
    )
  ) {
    errors.workflow = 'Use unique stage names and include open and completed work.'
  }

  if (Object.keys(errors).length > 0 || !draft.leadId) return { errors }
  return {
    errors,
    input: {
      workspaceId,
      key,
      name,
      description,
      leadId: draft.leadId,
      workflow: draft.workflow.map((status) => ({
        name: status.name.trim(),
        category: status.category,
      })),
    },
  }
}

function ProjectField({
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
    <div className="form-field">
      <label>
        <span>{label}</span>
        {children}
      </label>
      {error ? (
        <span className="form-field__error" id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

function ProjectCreateHeading() {
  return (
    <div>
      <p className="page-eyebrow">New workspace project</p>
      <h2 id="project-create-title">Create project</h2>
      <p id="project-create-description">
        Establish ownership and a valid initial workflow before work begins.
      </p>
    </div>
  )
}

function ProjectCreateState({
  message,
  onClose,
}: Readonly<{ message: string; onClose: () => void }>) {
  return (
    <div className="project-create-form">
      <ProjectCreateHeading />
      <p role="status">{message}</p>
      <div className="project-create-form__actions">
        <button className="secondary-button" type="button" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function formatCategory(category: WorkflowStatusCategory): string {
  return category.charAt(0).toLocaleUpperCase() + category.slice(1)
}
