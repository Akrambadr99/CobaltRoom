import type {
  Issue,
  ActivityEvent,
  Comment,
  IssueId,
  IssuePriority,
  IssueType,
  IsoDate,
  Label,
  LabelId,
  Project,
  ProjectId,
  UserId,
  User,
  WorkflowStatus,
  WorkflowStatusId,
  WorkspaceId,
} from '../../domain'

export type SortDirection = 'ascending' | 'descending'
export type IssueSortField =
  | 'createdAt'
  | 'dueDate'
  | 'number'
  | 'priority'
  | 'title'
  | 'updatedAt'

export interface PageRequest {
  readonly number: number
  readonly size: number
}

export interface Page<T> {
  readonly items: readonly T[]
  readonly pageNumber: number
  readonly pageSize: number
  readonly pageCount: number
  readonly totalItems: number
}

export interface IssueFilters {
  readonly workspaceId: WorkspaceId
  readonly projectIds?: readonly ProjectId[]
  readonly statusIds?: readonly WorkflowStatusId[]
  readonly priorities?: readonly IssuePriority[]
  readonly assigneeIds?: readonly UserId[]
  readonly includeUnassigned?: boolean
  readonly search?: string
}

export interface IssueQuery {
  readonly filters: IssueFilters
  readonly sort?: {
    readonly field: IssueSortField
    readonly direction: SortDirection
  }
  readonly page?: PageRequest
}

export interface RequestOptions {
  readonly signal?: AbortSignal
}

export interface CreateIssueInput {
  readonly workspaceId: WorkspaceId
  readonly projectId: ProjectId
  readonly type: IssueType
  readonly title: string
  readonly description: string
  readonly statusId: WorkflowStatusId
  readonly priority: IssuePriority
  readonly assigneeId: UserId | null
  readonly parentIssueId: IssueId | null
  readonly dueDate: IsoDate | null
  readonly labelIds: readonly LabelId[]
}

export interface IssueCreationProjectMetadata {
  readonly project: Project
  readonly statuses: readonly WorkflowStatus[]
  readonly assignees: readonly User[]
}

export interface IssueCreationMetadata {
  readonly projects: readonly IssueCreationProjectMetadata[]
  readonly labels: readonly Label[]
}

export interface BoardProjectMetadata {
  readonly project: Project
  readonly statuses: readonly WorkflowStatus[]
}

export interface BoardMetadata {
  readonly projects: readonly BoardProjectMetadata[]
}

export interface IssueActivityData {
  readonly comments: readonly Comment[]
  readonly activityEvents: readonly ActivityEvent[]
  readonly users: readonly User[]
}

export interface CreateCommentInput {
  readonly issueId: IssueId
  readonly body: string
}

export type MutableIssueFields = Pick<
  Issue,
  | 'assigneeId'
  | 'description'
  | 'dueDate'
  | 'labelIds'
  | 'parentIssueId'
  | 'priority'
  | 'statusId'
  | 'title'
  | 'type'
>

export interface UpdateIssueInput {
  readonly id: IssueId
  readonly expectedRevision: number
  readonly changes: Partial<MutableIssueFields>
}

export interface DeleteIssueInput {
  readonly id: IssueId
  readonly expectedRevision: number
}

export interface AtlasGateway {
  listProjects(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<readonly Project[]>
  listIssues(query: IssueQuery, options?: RequestOptions): Promise<Page<Issue>>
  getIssue(id: IssueId, options?: RequestOptions): Promise<Issue>
  getIssueCreationMetadata(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<IssueCreationMetadata>
  getBoardMetadata(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<BoardMetadata>
  getIssueActivity(
    issueId: IssueId,
    options?: RequestOptions,
  ): Promise<IssueActivityData>
  createComment(
    input: CreateCommentInput,
    options?: RequestOptions,
  ): Promise<Comment>
  createIssue(input: CreateIssueInput, options?: RequestOptions): Promise<Issue>
  updateIssue(input: UpdateIssueInput, options?: RequestOptions): Promise<Issue>
  deleteIssue(input: DeleteIssueInput, options?: RequestOptions): Promise<void>
}
