import type { IssueId, NotificationId, UserId, WorkspaceId } from './ids'
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
