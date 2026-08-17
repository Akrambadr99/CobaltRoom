import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EntityNotFoundError,
  ForbiddenGatewayError,
  GatewayConflictError,
  RequestCancelledError,
  SimulatedGatewayError,
} from './errors'
import { MockAtlasGateway } from './mock-gateway'
import { SimulatedNetwork } from './simulation'
import { InMemoryRequestTracer } from './tracing'
import { FixedClock } from '../clock'
import { createAtlasFixtures } from '../fixtures'
import { InMemoryDataStore } from '../store'
import { isoDateTime, issueId, type UserId } from '../../domain'

afterEach(() => {
  vi.useRealTimers()
})

function createGateway(
  simulator = new SimulatedNetwork(),
  requestedActorId?: UserId,
) {
  const fixtures = createAtlasFixtures()
  const defaultActorId = fixtures.memberships.find(
    ({ role }) => role === 'admin',
  )?.userId
  const actorId = requestedActorId ?? defaultActorId

  if (!actorId) {
    throw new Error('Expected an administrative fixture actor.')
  }

  const store = new InMemoryDataStore(fixtures)
  const tracer = new InMemoryRequestTracer()
  const clock = new FixedClock(isoDateTime('2026-02-01T08:00:00.000Z'))
  const gateway = new MockAtlasGateway({
    actorId,
    store,
    tracer,
    clock,
    simulator,
  })

  return { fixtures, gateway, store, tracer }
}

describe('MockAtlasGateway', () => {
  it('returns filtered, sorted, and paginated issues asynchronously', async () => {
    const { fixtures, gateway, tracer } = createGateway()
    const workspaceId = fixtures.workspaces[0]?.id
    const projectId = fixtures.projects[0]?.id

    if (!workspaceId || !projectId) {
      throw new Error('Expected fixture workspace and project records.')
    }

    const result = await gateway.listIssues({
      filters: { workspaceId, projectIds: [projectId] },
      sort: { field: 'number', direction: 'descending' },
      page: { number: 1, size: 2 },
    })

    expect(result.items.map(({ number }) => number)).toEqual([3, 2])
    expect(result.totalItems).toBe(3)
    expect(tracer.read()).toMatchObject([
      { requestId: 'req_000001', operation: 'issue.list', phase: 'started' },
      { requestId: 'req_000001', operation: 'issue.list', phase: 'succeeded' },
    ])
  })

  it('cancels in-flight reads and records a cancellation trace', async () => {
    vi.useFakeTimers()
    const simulator = new SimulatedNetwork({ latency: () => 5_000 })
    const { fixtures, gateway, tracer } = createGateway(simulator)
    const workspaceId = fixtures.workspaces[0]?.id
    const controller = new AbortController()

    if (!workspaceId) {
      throw new Error('Expected a fixture workspace.')
    }

    const request = gateway.listProjects(workspaceId, {
      signal: controller.signal,
    })
    controller.abort()

    await expect(request).rejects.toBeInstanceOf(RequestCancelledError)
    expect(tracer.read().map(({ phase }) => phase)).toEqual([
      'started',
      'cancelled',
    ])
  })

  it('honors cancellation after a zero-latency request has been queued', async () => {
    const { fixtures, gateway } = createGateway()
    const issue = fixtures.issues[0]
    const controller = new AbortController()

    if (!issue) {
      throw new Error('Expected a fixture issue.')
    }

    const request = gateway.getIssue(issue.id, { signal: controller.signal })
    controller.abort()

    await expect(request).rejects.toBeInstanceOf(RequestCancelledError)
  })

  it('surfaces simulated failures and records retryable error codes', async () => {
    const simulator = new SimulatedNetwork({
      failure: () => 'The mock service is unavailable.',
    })
    const { fixtures, gateway, tracer } = createGateway(simulator)
    const issue = fixtures.issues[0]

    if (!issue) {
      throw new Error('Expected a fixture issue.')
    }

    await expect(gateway.getIssue(issue.id)).rejects.toBeInstanceOf(
      SimulatedGatewayError,
    )
    expect(tracer.read()[1]).toMatchObject({
      phase: 'failed',
      errorCode: 'simulated-failure',
    })
  })

  it('creates an issue with the next project number and canonical metadata', async () => {
    const { fixtures, gateway, store } = createGateway()
    const template = fixtures.issues[0]

    if (!template) {
      throw new Error('Expected a fixture issue.')
    }

    const created = await gateway.createIssue({
      workspaceId: template.workspaceId,
      projectId: template.projectId,
      type: 'task',
      title: '  Confirm launch staffing  ',
      description: 'Verify launch-day on-call coverage.',
      statusId: template.statusId,
      priority: 'high',
      assigneeId: template.assigneeId,
      parentIssueId: null,
      dueDate: null,
      labelIds: [],
    })

    expect(created).toMatchObject({
      number: 4,
      title: 'Confirm launch staffing',
      revision: 1,
      createdAt: '2026-02-01T08:00:00.000Z',
    })
    expect(store.read().data.issues).toContainEqual(created)
  })

  it('updates with revision checks and rejects stale mutations', async () => {
    const { fixtures, gateway } = createGateway()
    const issue = fixtures.issues[0]

    if (!issue) {
      throw new Error('Expected a fixture issue.')
    }

    const updated = await gateway.updateIssue({
      id: issue.id,
      expectedRevision: issue.revision,
      changes: { title: 'Updated launch readiness brief', priority: 'high' },
    })

    expect(updated).toMatchObject({
      title: 'Updated launch readiness brief',
      priority: 'high',
      revision: issue.revision + 1,
    })
    await expect(
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { priority: 'low' },
      }),
    ).rejects.toBeInstanceOf(GatewayConflictError)
  })

  it('rejects mutation bypass attempts for a read-only actor', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId

    if (!viewerId) {
      throw new Error('Expected a read-only fixture actor.')
    }

    const { gateway, tracer } = createGateway(new SimulatedNetwork(), viewerId)
    const issue = fixtures.issues[0]

    if (!issue) {
      throw new Error('Expected a fixture issue.')
    }

    await expect(
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { priority: 'low' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenGatewayError)
    expect(tracer.read().at(-1)).toMatchObject({
      operation: 'issue.update',
      phase: 'failed',
      errorCode: 'forbidden',
    })
  })

  it('limits member mutations to projects where the actor has a project role', async () => {
    const fixtures = createAtlasFixtures()
    const memberId = fixtures.memberships.find(({ role }) => role === 'member')?.userId
    const permittedProject = fixtures.projectMembers.find(
      ({ userId }) => userId === memberId,
    )?.projectId
    const permittedIssue = fixtures.issues.find(
      ({ projectId }) => projectId === permittedProject,
    )
    const deniedIssue = fixtures.issues.find(
      ({ projectId }) => projectId !== permittedProject,
    )

    if (!memberId || !permittedIssue || !deniedIssue) {
      throw new Error('Expected project-scoped member fixtures.')
    }

    const { gateway } = createGateway(new SimulatedNetwork(), memberId)

    await expect(
      gateway.updateIssue({
        id: permittedIssue.id,
        expectedRevision: permittedIssue.revision,
        changes: { priority: 'medium' },
      }),
    ).resolves.toMatchObject({ priority: 'medium' })
    await expect(
      gateway.updateIssue({
        id: deniedIssue.id,
        expectedRevision: deniedIssue.revision,
        changes: { priority: 'medium' },
      }),
    ).rejects.toBeInstanceOf(ForbiddenGatewayError)
  })

  it('denies reads when workspace membership is suspended', async () => {
    const fixtures = createAtlasFixtures()
    const actor = fixtures.memberships.find(({ role }) => role === 'viewer')

    if (!actor) {
      throw new Error('Expected a fixture actor.')
    }

    const suspendedFixtures = {
      ...fixtures,
      memberships: fixtures.memberships.map((membership) =>
        membership.id === actor.id
          ? { ...membership, status: 'suspended' as const }
          : membership,
      ),
    }
    const gateway = new MockAtlasGateway({
      actorId: actor.userId,
      store: new InMemoryDataStore(suspendedFixtures),
    })

    await expect(gateway.listProjects(actor.workspaceId)).rejects.toBeInstanceOf(
      ForbiddenGatewayError,
    )
  })

  it('deletes a leaf issue and its related comments and relations', async () => {
    const { fixtures, gateway, store } = createGateway()
    const issue = fixtures.issues.find(({ number, projectId }) => {
      const firstProject = fixtures.projects[0]
      return number === 1 && projectId === firstProject?.id
    })

    if (!issue) {
      throw new Error('Expected the launch brief fixture issue.')
    }

    await gateway.deleteIssue({ id: issue.id, expectedRevision: issue.revision })

    const snapshot = store.read().data
    expect(snapshot.issues.some(({ id }) => id === issue.id)).toBe(false)
    expect(snapshot.comments.some(({ issueId }) => issueId === issue.id)).toBe(false)
    expect(
      snapshot.issueRelations.some(
        ({ sourceIssueId, targetIssueId }) =>
          sourceIssueId === issue.id || targetIssueId === issue.id,
      ),
    ).toBe(false)
  })

  it('protects parents with subtasks from deletion', async () => {
    const { fixtures, gateway } = createGateway()
    const child = fixtures.issues.find(({ parentIssueId }) => parentIssueId !== null)
    const parent = fixtures.issues.find(({ id }) => id === child?.parentIssueId)

    if (!parent) {
      throw new Error('Expected a parent issue fixture.')
    }

    await expect(
      gateway.deleteIssue({ id: parent.id, expectedRevision: parent.revision }),
    ).rejects.toBeInstanceOf(GatewayConflictError)
  })

  it('returns a typed not-found failure for missing entities', async () => {
    const { gateway } = createGateway()

    await expect(
      gateway.getIssue(issueId('issue_missing_record')),
    ).rejects.toBeInstanceOf(EntityNotFoundError)
  })
})
