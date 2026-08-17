import type {
  ProjectId,
  ProjectMemberId,
  UserId,
  WorkflowStatusId,
  WorkspaceId,
} from './ids'
import type { IsoDateTime } from './time'

export type ProjectStatus =
  | 'planned'
  | 'active'
  | 'paused'
  | 'completed'
  | 'archived'
export type ProjectMemberRole = 'lead' | 'contributor' | 'viewer'
export type WorkflowStatusCategory = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'

export interface Project {
  readonly id: ProjectId
  readonly workspaceId: WorkspaceId
  readonly key: string
  readonly name: string
  readonly description: string
  readonly leadId: UserId
  readonly status: ProjectStatus
  readonly revision: number
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export interface ProjectMember {
  readonly id: ProjectMemberId
  readonly projectId: ProjectId
  readonly userId: UserId
  readonly role: ProjectMemberRole
}

export interface WorkflowStatus {
  readonly id: WorkflowStatusId
  readonly projectId: ProjectId
  readonly name: string
  readonly category: WorkflowStatusCategory
  readonly order: number
}
