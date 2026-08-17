import type {
  CreateIssueInput,
  IssueCreationMetadata,
  MutableIssueFields,
} from '../../data'
import {
  isoDate,
  type IssuePriority,
  type IssueType,
  type LabelId,
  type ProjectId,
  type UserId,
  type WorkflowStatusId,
  type WorkspaceId,
} from '../../domain'

export interface IssueEditDraft {
  readonly title: string
  readonly description: string
  readonly priority: IssuePriority
  readonly dueDate: string
}

export interface IssueEditValidation {
  readonly changes: Partial<MutableIssueFields> | null
  readonly errors: Readonly<Partial<Record<keyof IssueEditDraft, string>>>
}

export interface IssueCreateDraft {
  readonly projectId: ProjectId | null
  readonly title: string
  readonly description: string
  readonly type: IssueType
  readonly statusId: WorkflowStatusId | null
  readonly priority: IssuePriority
  readonly assigneeId: UserId | null
  readonly dueDate: string
  readonly labelIds: readonly LabelId[]
}

export interface IssueCreateValidation {
  readonly input: CreateIssueInput | null
  readonly errors: Readonly<Partial<Record<keyof IssueCreateDraft, string>>>
}

export function createInitialIssueDraft(
  metadata: IssueCreationMetadata,
): IssueCreateDraft {
  const project = metadata.projects[0]

  return {
    projectId: project?.project.id ?? null,
    title: '',
    description: '',
    type: 'task',
    statusId: project?.statuses[0]?.id ?? null,
    priority: 'medium',
    assigneeId: null,
    dueDate: '',
    labelIds: [],
  }
}

export function validateIssueCreateDraft(
  draft: IssueCreateDraft,
  metadata: IssueCreationMetadata,
  workspaceId: WorkspaceId,
): IssueCreateValidation {
  const errors: Partial<Record<keyof IssueCreateDraft, string>> = {}
  const title = draft.title.trim()
  const description = draft.description.trim()
  const project = metadata.projects.find(
    ({ project }) => project.id === draft.projectId,
  )

  if (!project) errors.projectId = 'Choose a project where you can create issues.'
  if (title.length === 0) errors.title = 'Enter an issue title.'
  else if (title.length > 160) errors.title = 'Keep the title to 160 characters.'
  if (description.length > 5_000) {
    errors.description = 'Keep the description to 5,000 characters.'
  }
  if (!project?.statuses.some(({ id }) => id === draft.statusId)) {
    errors.statusId = 'Choose a status from the project workflow.'
  }
  if (
    draft.assigneeId !== null &&
    !project?.assignees.some(({ id }) => id === draft.assigneeId)
  ) {
    errors.assigneeId = 'Choose an active project member.'
  }

  const validLabelIds = new Set(metadata.labels.map(({ id }) => id))
  if (
    new Set(draft.labelIds).size !== draft.labelIds.length ||
    draft.labelIds.some((id) => !validLabelIds.has(id))
  ) {
    errors.labelIds = 'Choose valid workspace labels.'
  }

  let dueDate = null
  if (draft.dueDate) {
    try {
      dueDate = isoDate(draft.dueDate)
    } catch {
      errors.dueDate = 'Enter a valid calendar date.'
    }
  }

  return {
    input:
      Object.keys(errors).length === 0 &&
      draft.projectId !== null &&
      draft.statusId !== null
        ? {
            workspaceId,
            projectId: draft.projectId,
            type: draft.type,
            title,
            description,
            statusId: draft.statusId,
            priority: draft.priority,
            assigneeId: draft.assigneeId,
            parentIssueId: null,
            dueDate,
            labelIds: draft.labelIds,
          }
        : null,
    errors,
  }
}

export function validateIssueEditDraft(
  draft: IssueEditDraft,
): IssueEditValidation {
  const errors: Partial<Record<keyof IssueEditDraft, string>> = {}
  const title = draft.title.trim()
  const description = draft.description.trim()

  if (title.length === 0) errors.title = 'Enter an issue title.'
  else if (title.length > 160) errors.title = 'Keep the title to 160 characters.'

  if (description.length > 5_000) {
    errors.description = 'Keep the description to 5,000 characters.'
  }

  let dueDate = null
  if (draft.dueDate) {
    try {
      dueDate = isoDate(draft.dueDate)
    } catch {
      errors.dueDate = 'Enter a valid calendar date.'
    }
  }

  return {
    changes:
      Object.keys(errors).length === 0
        ? { title, description, priority: draft.priority, dueDate }
        : null,
    errors,
  }
}
