import type {
  IssueId,
  MembershipId,
  NotificationId,
  NotificationPreferenceId,
  ProjectId,
  UserId,
  WorkspaceInvitationId,
  WorkspaceId,
} from './ids'
import type { IsoDateTime } from './time'

export type NotificationKind =
  | 'assignment'
  | 'comment'
  | 'mention'
  | 'issue-update'
  | 'project-update'
  | 'workspace-administration'
  | 'governance'

export type NotificationCategory =
  | 'work'
  | 'collaboration'
  | 'administration'
  | 'governance'

export type NotificationTarget =
  | { readonly kind: 'issue'; readonly id: IssueId }
  | { readonly kind: 'project'; readonly id: ProjectId }
  | { readonly kind: 'workspace'; readonly id: WorkspaceId }
  | {
      readonly kind: 'administration'
      readonly id: MembershipId | WorkspaceInvitationId | null
    }
  | { readonly kind: 'governance'; readonly id: string }

export interface Notification {
  readonly id: NotificationId
  readonly workspaceId: WorkspaceId
  readonly recipientId: UserId
  readonly kind: NotificationKind
  readonly target: NotificationTarget
  readonly title: string
  readonly body: string
  readonly occurredAt: IsoDateTime
  readonly readAt: IsoDateTime | null
}

export function notificationCategory(kind: NotificationKind): NotificationCategory {
  if (kind === 'comment' || kind === 'mention') return 'collaboration'
  if (kind === 'workspace-administration') return 'administration'
  if (kind === 'governance') return 'governance'
  return 'work'
}

export interface NotificationPreferences {
  readonly id: NotificationPreferenceId
  readonly workspaceId: WorkspaceId
  readonly userId: UserId
  readonly assignments: boolean
  readonly comments: boolean
  readonly issueUpdates: boolean
  readonly revision: number
}
