import type { ProjectId } from './ids'
import type { ProjectMember, ProjectMemberRole } from './project'
import type { Membership, WorkspaceRole } from './workspace'

export const permissions = [
  'workspace:view',
  'workspace:manage',
  'analytics:view',
  'notifications:view-self',
  'notification-preferences:manage-self',
  'members:manage',
  'project:create',
  'project:view',
  'project:update',
  'project:archive',
  'issue:view',
  'issue:create',
  'issue:update',
  'issue:delete',
  'comment:create',
  'comment:delete',
  'audit:view',
] as const

export type Permission = (typeof permissions)[number]

export interface AuthorizationContext {
  readonly workspaceMembership: Membership
  readonly projectMembership: ProjectMember | null
}

const workspacePermissions: Readonly<Record<WorkspaceRole, ReadonlySet<Permission>>> = {
  owner: new Set(permissions),
  admin: new Set([
    'workspace:view',
    'analytics:view',
    'notifications:view-self',
    'notification-preferences:manage-self',
    'members:manage',
    'project:create',
    'project:view',
    'project:update',
    'project:archive',
    'issue:view',
    'issue:create',
    'issue:update',
    'issue:delete',
    'comment:create',
    'comment:delete',
    'audit:view',
  ]),
  member: new Set([
    'workspace:view',
    'analytics:view',
    'notifications:view-self',
    'notification-preferences:manage-self',
    'project:create',
    'project:view',
    'issue:view',
  ]),
  viewer: new Set([
    'workspace:view',
    'analytics:view',
    'notifications:view-self',
    'notification-preferences:manage-self',
    'project:view',
    'issue:view',
  ]),
}

const projectPermissions: Readonly<
  Record<ProjectMemberRole, ReadonlySet<Permission>>
> = {
  lead: new Set([
    'project:update',
    'project:archive',
    'issue:create',
    'issue:update',
    'issue:delete',
    'comment:create',
    'comment:delete',
  ]),
  contributor: new Set([
    'issue:create',
    'issue:update',
    'comment:create',
    'comment:delete',
  ]),
  viewer: new Set(),
}

export function can(
  context: AuthorizationContext,
  permission: Permission,
  projectId?: ProjectId,
): boolean {
  const { workspaceMembership, projectMembership } = context

  if (workspaceMembership.status !== 'active') {
    return false
  }

  if (workspacePermissions[workspaceMembership.role].has(permission)) {
    return true
  }

  if (!projectId || projectMembership?.projectId !== projectId) {
    return false
  }

  return projectPermissions[projectMembership.role].has(permission)
}

export function getPermissionFingerprint(
  workspaceMembership: Membership,
  projectMemberships: readonly ProjectMember[],
): string {
  const projects = projectMemberships
    .map(({ projectId, role }) => `${projectId}:${role}`)
    .sort((left, right) => left.localeCompare(right))
    .join('|')
  return [
    workspaceMembership.id,
    workspaceMembership.role,
    workspaceMembership.status,
    projects,
  ].join(';')
}
