import type {
  ActivityEvent,
  AuditEvent,
  Comment,
  Issue,
  IssueRelation,
  Label,
  Membership,
  Notification,
  NotificationPreferences,
  Project,
  ProjectMember,
  User,
  WorkflowStatus,
  Workspace,
} from '../domain'

export interface AtlasDataSnapshot {
  readonly workspaces: readonly Workspace[]
  readonly users: readonly User[]
  readonly memberships: readonly Membership[]
  readonly projects: readonly Project[]
  readonly projectMembers: readonly ProjectMember[]
  readonly workflowStatuses: readonly WorkflowStatus[]
  readonly labels: readonly Label[]
  readonly issues: readonly Issue[]
  readonly issueRelations: readonly IssueRelation[]
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
