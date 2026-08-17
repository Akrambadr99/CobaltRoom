import type {
  Issue,
  ActivityEvent,
  AuditEvent,
  Comment,
  CommentId,
  IssueId,
  IssuePriority,
  IssueType,
  IsoDate,
  IsoDateTime,
  Label,
  LabelId,
  Notification,
  NotificationId,
  NotificationPreferences,
  Membership,
  ProjectMember,
  Project,
  ProjectId,
  ProjectStatus,
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

export interface ProjectSummaryQuery {
  readonly workspaceId: WorkspaceId
  readonly search?: string
  readonly statuses?: readonly ProjectStatus[]
  readonly page?: PageRequest
}

export interface ProjectSummary {
  readonly project: Project
  readonly totalIssues: number
  readonly openIssues: number
  readonly completedIssues: number
}

export interface ProjectEditMetadata {
  readonly project: Project
  readonly eligibleLeads: readonly User[]
}

export type MutableProjectFields = Pick<
  Project,
  'description' | 'leadId' | 'name' | 'status'
>

export interface UpdateProjectInput {
  readonly id: ProjectId
  readonly expectedRevision: number
  readonly changes: Partial<MutableProjectFields>
}

export interface ArchiveProjectInput {
  readonly id: ProjectId
  readonly expectedRevision: number
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

export interface UpdateCommentInput {
  readonly id: CommentId
  readonly expectedRevision: number
  readonly body: string
}

export interface DeleteCommentInput {
  readonly id: CommentId
  readonly expectedRevision: number
}

export interface NotificationQuery {
  readonly workspaceId: WorkspaceId
  readonly page?: PageRequest
}

export interface NotificationInbox extends Page<Notification> {
  readonly unreadCount: number
}

export interface MarkNotificationReadInput {
  readonly id: NotificationId
  readonly read: boolean
}

export interface UpdateNotificationPreferencesInput {
  readonly workspaceId: WorkspaceId
  readonly expectedRevision: number
  readonly assignments: boolean
  readonly comments: boolean
  readonly issueUpdates: boolean
}

export interface AnalyticsBreakdown<TValue extends string> {
  readonly value: TValue
  readonly count: number
}

export interface ProjectHealthAggregate {
  readonly projectId: ProjectId
  readonly projectKey: string
  readonly projectName: string
  readonly totalIssues: number
  readonly openIssues: number
  readonly completedIssues: number
  readonly urgentOpenIssues: number
  readonly overdueIssues: number
  readonly completionPercent: number
}

export interface WorkspaceAnalytics {
  readonly generatedAt: IsoDateTime
  readonly activeProjects: number
  readonly totalIssues: number
  readonly openIssues: number
  readonly completedIssues: number
  readonly urgentOpenIssues: number
  readonly overdueIssues: number
  readonly unassignedOpenIssues: number
  readonly priorities: readonly AnalyticsBreakdown<IssuePriority>[]
  readonly statusCategories: readonly AnalyticsBreakdown<WorkflowStatus['category']>[]
  readonly projects: readonly ProjectHealthAggregate[]
}

export interface GovernanceQuery {
  readonly workspaceId: WorkspaceId
  readonly action?: string
  readonly outcome?: AuditEvent['outcome']
  readonly page?: PageRequest
}

export interface GovernanceAuditEntry {
  readonly event: AuditEvent
  readonly actorName: string
}

export interface GovernanceReport {
  readonly generatedAt: IsoDateTime
  readonly totalEvents: number
  readonly succeededEvents: number
  readonly rejectedEvents: number
  readonly failedEvents: number
  readonly actions: readonly AnalyticsBreakdown<string>[]
  readonly events: Page<GovernanceAuditEntry>
}

export interface AuthorizationSession {
  readonly user: User
  readonly workspaceMembership: Membership
  readonly projectMemberships: readonly ProjectMember[]
  readonly snapshotVersion: number
  readonly permissionFingerprint: string
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
  getAuthorizationSession(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<AuthorizationSession>
  listProjects(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<readonly Project[]>
  listProjectSummaries(
    query: ProjectSummaryQuery,
    options?: RequestOptions,
  ): Promise<Page<ProjectSummary>>
  getProjectEditMetadata(
    projectId: ProjectId,
    options?: RequestOptions,
  ): Promise<ProjectEditMetadata>
  updateProject(
    input: UpdateProjectInput,
    options?: RequestOptions,
  ): Promise<Project>
  archiveProject(
    input: ArchiveProjectInput,
    options?: RequestOptions,
  ): Promise<Project>
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
  getWorkspaceAnalytics(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<WorkspaceAnalytics>
  getGovernanceReport(
    query: GovernanceQuery,
    options?: RequestOptions,
  ): Promise<GovernanceReport>
  getIssueActivity(
    issueId: IssueId,
    options?: RequestOptions,
  ): Promise<IssueActivityData>
  createComment(
    input: CreateCommentInput,
    options?: RequestOptions,
  ): Promise<Comment>
  updateComment(
    input: UpdateCommentInput,
    options?: RequestOptions,
  ): Promise<Comment>
  deleteComment(
    input: DeleteCommentInput,
    options?: RequestOptions,
  ): Promise<Comment>
  listNotifications(
    query: NotificationQuery,
    options?: RequestOptions,
  ): Promise<NotificationInbox>
  markNotificationRead(
    input: MarkNotificationReadInput,
    options?: RequestOptions,
  ): Promise<Notification>
  markAllNotificationsRead(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<number>
  getNotificationPreferences(
    workspaceId: WorkspaceId,
    options?: RequestOptions,
  ): Promise<NotificationPreferences>
  updateNotificationPreferences(
    input: UpdateNotificationPreferencesInput,
    options?: RequestOptions,
  ): Promise<NotificationPreferences>
  createIssue(input: CreateIssueInput, options?: RequestOptions): Promise<Issue>
  updateIssue(input: UpdateIssueInput, options?: RequestOptions): Promise<Issue>
  deleteIssue(input: DeleteIssueInput, options?: RequestOptions): Promise<void>
}
