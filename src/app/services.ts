import {
  createAtlasFixtures,
  InMemoryDataStore,
  MockAtlasGateway,
  SimulatedNetwork,
  type AtlasGateway,
  type Clock,
  type RequestSimulator,
} from '../data'
import type { WorkspaceId } from '../domain'

export interface AppServices {
  readonly gateway: AtlasGateway
  readonly workspaceId: WorkspaceId
}

export interface CreateAppServicesOptions {
  readonly clock?: Clock
  readonly simulator?: RequestSimulator
}

export function createAppServices(
  options: CreateAppServicesOptions = {},
): AppServices {
  const fixtures = createAtlasFixtures()
  const workspaceId = fixtures.workspaces[0]?.id

  if (!workspaceId) {
    throw new Error('Atlas Ops requires a default workspace fixture.')
  }

  const simulator =
    options.simulator ??
    new SimulatedNetwork({
      latency: (operation) => (operation.endsWith('.list') ? 80 : 120),
    })
  const gatewayOptions = {
    store: new InMemoryDataStore(fixtures),
    simulator,
    ...(options.clock ? { clock: options.clock } : {}),
  }

  return {
    workspaceId,
    gateway: new MockAtlasGateway(gatewayOptions),
  }
}
