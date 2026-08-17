import {
  createAtlasFixtures,
  InMemoryDataStore,
  MockAtlasGateway,
  SimulatedNetwork,
  type AtlasGateway,
  type Clock,
  type RequestSimulator,
} from '../data'
import {
  can,
  type Membership,
  type Permission,
  type ProjectId,
  type ProjectMember,
  type User,
  type UserId,
  type WorkspaceId,
} from '../domain'
import { UserPreferenceRepository } from '../preferences/repository'
import {
  MemoryPreferenceStorage,
  type PreferenceStorage,
} from '../preferences/storage'

export interface AppSession {
  readonly user: User
  readonly workspaceMembership: Membership
  readonly projectMemberships: readonly ProjectMember[]
}

export interface AppServices {
  readonly gateway: AtlasGateway
  readonly preferences: UserPreferenceRepository
  readonly session: AppSession
  readonly workspaceId: WorkspaceId
  can(permission: Permission, projectId?: ProjectId): boolean
}

export interface CreateAppServicesOptions {
  readonly clock?: Clock
  readonly simulator?: RequestSimulator
  readonly actorId?: UserId
  readonly preferenceStorage?: PreferenceStorage
}

export function createAppServices(
  options: CreateAppServicesOptions = {},
): AppServices {
  const fixtures = createAtlasFixtures()
  const workspaceId = fixtures.workspaces[0]?.id

  if (!workspaceId) {
    throw new Error('Atlas Ops requires a default workspace fixture.')
  }

  const defaultMembership = fixtures.memberships.find(
    ({ role, status, workspaceId: memberWorkspaceId }) =>
      memberWorkspaceId === workspaceId && role === 'admin' && status === 'active',
  )
  const actorId = options.actorId ?? defaultMembership?.userId
  const user = fixtures.users.find(({ id }) => id === actorId)
  const workspaceMembership = fixtures.memberships.find(
    (membership) =>
      membership.workspaceId === workspaceId && membership.userId === actorId,
  )

  if (!actorId || !user || !workspaceMembership) {
    throw new Error('Atlas Ops requires an actor with workspace membership.')
  }

  const projectMemberships = fixtures.projectMembers.filter(
    (membership) => membership.userId === actorId,
  )
  const session: AppSession = { user, workspaceMembership, projectMemberships }

  const simulator =
    options.simulator ??
    new SimulatedNetwork({
      latency: (operation) => (operation.endsWith('.list') ? 80 : 120),
    })
  const gatewayOptions = {
    actorId,
    store: new InMemoryDataStore(fixtures),
    simulator,
    ...(options.clock ? { clock: options.clock } : {}),
  }
  const preferences = new UserPreferenceRepository({
    storage: options.preferenceStorage ?? new MemoryPreferenceStorage(),
    storageKey: `atlas-ops:${workspaceId}:${actorId}:preferences`,
    ...(options.clock ? { clock: options.clock } : {}),
  })

  return {
    workspaceId,
    session,
    gateway: new MockAtlasGateway(gatewayOptions),
    preferences,
    can: (permission, projectId) =>
      can(
        {
          workspaceMembership,
          projectMembership:
            projectMemberships.find(
              (membership) => membership.projectId === projectId,
            ) ?? null,
        },
        permission,
        projectId,
      ),
  }
}
