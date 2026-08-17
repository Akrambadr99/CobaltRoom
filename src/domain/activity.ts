import type { ActivityEventId, AuditEventId, UserId, WorkspaceId } from './ids'
import type { IsoDateTime } from './time'

export type EntityKind =
  | 'workspace'
  | 'project'
  | 'issue'
  | 'comment'
  | 'member'
  | 'invitation'

export interface ActivityEvent {
  readonly id: ActivityEventId
  readonly workspaceId: WorkspaceId
  readonly actorId: UserId
  readonly entityKind: EntityKind
  readonly entityId: string
  readonly action: string
  readonly occurredAt: IsoDateTime
  readonly summary: string
}

export interface AuditEvent {
  readonly id: AuditEventId
  readonly workspaceId: WorkspaceId
  readonly actorId: UserId | null
  readonly requestId: string
  readonly action: string
  readonly outcome: 'succeeded' | 'rejected' | 'failed'
  readonly occurredAt: IsoDateTime
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>
}
