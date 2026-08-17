import type {
  IssueId,
  NotificationId,
  NotificationPreferenceId,
  UserId,
  WorkspaceId,
} from './ids'
import type { IsoDateTime } from './time'

export type NotificationKind = 'assignment' | 'comment' | 'issue-update'

export interface Notification {
  readonly id: NotificationId
  readonly workspaceId: WorkspaceId
  readonly recipientId: UserId
  readonly kind: NotificationKind
  readonly issueId: IssueId
  readonly title: string
  readonly body: string
  readonly occurredAt: IsoDateTime
  readonly readAt: IsoDateTime | null
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
