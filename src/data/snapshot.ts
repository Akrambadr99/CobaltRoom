import type {
  ActivityEvent,
  AuditEvent,
  Comment,
  Issue,
  IssueRelation,
  IssueSubscription,
  Label,
  Membership,
  Notification,
  NotificationPreferences,
  Project,
  ProjectMember,
  User,
  WorkflowStatus,
  Workspace,
  WorkspaceInvitation,
} from '../domain'

export interface AtlasDataSnapshot {
  readonly workspaces: readonly Workspace[]
  readonly users: readonly User[]
  readonly memberships: readonly Membership[]
  readonly workspaceInvitations: readonly WorkspaceInvitation[]
  readonly projects: readonly Project[]
  readonly projectMembers: readonly ProjectMember[]
  readonly workflowStatuses: readonly WorkflowStatus[]
  readonly labels: readonly Label[]
  readonly issues: readonly Issue[]
  readonly issueRelations: readonly IssueRelation[]
  readonly issueSubscriptions: readonly IssueSubscription[]
  readonly comments: readonly Comment[]
  readonly activityEvents: readonly ActivityEvent[]
  readonly auditEvents: readonly AuditEvent[]
  readonly notifications: readonly Notification[]
  readonly notificationPreferences: readonly NotificationPreferences[]
}

export interface VersionedSnapshot {
  readonly version: number
  readonly data: AtlasDataSnapshot
}
