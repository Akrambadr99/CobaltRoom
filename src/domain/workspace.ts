import type { MembershipId, UserId, WorkspaceId } from './ids'
import type { IsoDateTime } from './time'

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'
export type MembershipStatus = 'invited' | 'active' | 'suspended'

export interface Workspace {
  readonly id: WorkspaceId
  readonly name: string
  readonly slug: string
  readonly createdAt: IsoDateTime
}

export interface User {
  readonly id: UserId
  readonly displayName: string
  readonly email: string
  readonly initials: string
}

export interface Membership {
  readonly id: MembershipId
  readonly workspaceId: WorkspaceId
  readonly userId: UserId
  readonly role: WorkspaceRole
  readonly status: MembershipStatus
  readonly joinedAt: IsoDateTime | null
  readonly revision: number
}
