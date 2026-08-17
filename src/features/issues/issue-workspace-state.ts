import type {
  IssueQuery,
  IssueSortField,
  SortDirection,
} from '../../data'
import {
  projectId,
  workflowStatusId,
  type IssuePriority,
  type ProjectId,
  type WorkflowStatusId,
  type WorkspaceId,
} from '../../domain'

export interface IssueWorkspaceState {
  readonly search: string
  readonly projectId: ProjectId | null
  readonly statusId: WorkflowStatusId | null
  readonly priority: IssuePriority | null
  readonly sortField: IssueSortField
  readonly sortDirection: SortDirection
  readonly page: number
}

export const issueWorkspaceDefaults: IssueWorkspaceState = {
  search: '',
  projectId: null,
  statusId: null,
  priority: null,
  sortField: 'updatedAt',
  sortDirection: 'descending',
  page: 1,
}

const priorities: readonly IssuePriority[] = [
  'urgent',
  'high',
  'medium',
  'low',
  'none',
]
const sortFields: readonly IssueSortField[] = [
  'createdAt',
  'dueDate',
  'number',
  'priority',
  'title',
  'updatedAt',
]

export function parseIssueWorkspaceState(
  parameters: URLSearchParams,
): IssueWorkspaceState {
  const search = parameters.get('q')?.trim().slice(0, 200) ?? ''
  const priorityValue = parameters.get('priority')
  const sortValue = parameters.get('sort')
  const directionValue = parameters.get('direction')
  const parsedPage = Number(parameters.get('page'))

  return {
    search,
    projectId: parseProjectId(parameters.get('project')),
    statusId: parseStatusId(parameters.get('status')),
    priority: priorities.find((candidate) => candidate === priorityValue) ?? null,
    sortField:
      sortFields.find((candidate) => candidate === sortValue) ??
      issueWorkspaceDefaults.sortField,
    sortDirection:
      directionValue === 'ascending' || directionValue === 'descending'
        ? directionValue
        : issueWorkspaceDefaults.sortDirection,
    page:
      Number.isSafeInteger(parsedPage) && parsedPage > 0
        ? parsedPage
        : issueWorkspaceDefaults.page,
  }
}

export function serializeIssueWorkspaceState(
  state: IssueWorkspaceState,
): URLSearchParams {
  const parameters = new URLSearchParams()

  if (state.search) parameters.set('q', state.search)
  if (state.projectId) parameters.set('project', state.projectId)
  if (state.statusId) parameters.set('status', state.statusId)
  if (state.priority) parameters.set('priority', state.priority)
  if (state.sortField !== issueWorkspaceDefaults.sortField) {
    parameters.set('sort', state.sortField)
  }
  if (state.sortDirection !== issueWorkspaceDefaults.sortDirection) {
    parameters.set('direction', state.sortDirection)
  }
  if (state.page !== issueWorkspaceDefaults.page) {
    parameters.set('page', state.page.toString())
  }

  return parameters
}

export function toIssueQuery(
  workspaceId: WorkspaceId,
  state: IssueWorkspaceState,
  pageSize = 5,
): IssueQuery {
  return {
    filters: {
      workspaceId,
      ...(state.projectId ? { projectIds: [state.projectId] } : {}),
      ...(state.statusId ? { statusIds: [state.statusId] } : {}),
      ...(state.priority ? { priorities: [state.priority] } : {}),
      ...(state.search ? { search: state.search } : {}),
    },
    sort: { field: state.sortField, direction: state.sortDirection },
    page: { number: state.page, size: pageSize },
  }
}

export interface IssueWorkspaceFilterProject {
  readonly id: ProjectId
  readonly statusIds: readonly WorkflowStatusId[]
}

export function reconcileIssueWorkspaceState(
  state: IssueWorkspaceState,
  projects: readonly IssueWorkspaceFilterProject[],
): IssueWorkspaceState {
  const selectedProject = state.projectId
    ? projects.find(({ id }) => id === state.projectId)
    : null
  const projectId = state.projectId && selectedProject ? state.projectId : null
  const statusId = state.statusId
  const statusIsAvailable = statusId
    ? state.projectId && !selectedProject
      ? false
      : projectId
      ? selectedProject?.statusIds.includes(statusId) === true
      : projects.some(({ statusIds }) => statusIds.includes(statusId))
    : true

  if (projectId === state.projectId && statusIsAvailable) return state
  return {
    ...state,
    projectId,
    statusId: statusIsAvailable ? statusId : null,
    page: 1,
  }
}

function parseProjectId(value: string | null): ProjectId | null {
  if (!value) return null

  try {
    return projectId(value)
  } catch {
    return null
  }
}

function parseStatusId(value: string | null): WorkflowStatusId | null {
  if (!value) return null

  try {
    return workflowStatusId(value)
  } catch {
    return null
  }
}
