import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  EntityNotFoundError,
  ForbiddenGatewayError,
  GatewayConflictError,
  InvalidGatewayRequestError,
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
  it('returns an authoritative analytics snapshot with request tracing', async () => {
    const { fixtures, gateway, tracer } = createGateway()
    const workspaceId = fixtures.workspaces[0]?.id
    if (!workspaceId) throw new Error('Expected a fixture workspace.')

    const analytics = await gateway.getWorkspaceAnalytics(workspaceId)
    expect(analytics).toMatchObject({
      generatedAt: '2026-02-01T08:00:00.000Z',
      totalIssues: 6,
      activeProjects: 2,
    })
    expect(tracer.read()).toMatchObject([
      { operation: 'analytics.get', phase: 'started' },
      { operation: 'analytics.get', phase: 'succeeded' },
    ])
  })

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

  it('isolates the actor notification inbox and persists read state', async () => {
    const { fixtures, gateway, store, tracer } = createGateway()
    const workspaceId = fixtures.workspaces[0]?.id
    const actorId = fixtures.memberships.find(({ role }) => role === 'admin')?.userId
    const unread = fixtures.notifications.find(
      (notification) =>
        notification.recipientId === actorId && notification.readAt === null,
    )

    if (!workspaceId || !unread) {
      throw new Error('Expected an unread administrative notification fixture.')
    }

    const inbox = await gateway.listNotifications(workspaceId)
    expect(inbox.items).toHaveLength(2)
    expect(inbox.unreadCount).toBe(1)

    const marked = await gateway.markNotificationRead({ id: unread.id, read: true })
    expect(marked.readAt).toBe('2026-02-01T08:00:00.000Z')
    expect(store.read().data.notifications.find(({ id }) => id === unread.id)?.readAt).toBe(
      '2026-02-01T08:00:00.000Z',
    )

    await gateway.markNotificationRead({ id: unread.id, read: false })
    await expect(gateway.markAllNotificationsRead(workspaceId)).resolves.toBe(1)
    expect((await gateway.listNotifications(workspaceId)).unreadCount).toBe(0)
    expect(tracer.read().some(({ operation }) => operation === 'notification.list')).toBe(
      true,
    )
  })

  it('prevents actors from changing another recipient notification', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    const administrativeNotification = fixtures.notifications[0]

    if (!viewerId || !administrativeNotification) {
      throw new Error('Expected viewer and notification fixtures.')
    }

    const { gateway } = createGateway(new SimulatedNetwork(), viewerId)
    await expect(
      gateway.markNotificationRead({
        id: administrativeNotification.id,
        read: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenGatewayError)
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

  it('returns creation metadata only for projects the actor can contribute to', async () => {
    const fixtures = createAtlasFixtures()
    const memberId = fixtures.memberships.find(({ role }) => role === 'member')?.userId
    const expectedProjectId = fixtures.projectMembers.find(
      ({ userId }) => userId === memberId,
    )?.projectId
    const workspaceId = fixtures.workspaces[0]?.id

    if (!memberId || !expectedProjectId || !workspaceId) {
      throw new Error('Expected project-scoped member fixtures.')
    }

    const { gateway } = createGateway(new SimulatedNetwork(), memberId)
    const metadata = await gateway.getIssueCreationMetadata(workspaceId)

    expect(metadata.projects).toHaveLength(1)
    expect(metadata.projects[0]?.project.id).toBe(expectedProjectId)
    expect(metadata.projects[0]?.statuses.map(({ order }) => order)).toEqual([
      0, 1, 2,
    ])
    expect(metadata.projects[0]?.assignees.map(({ displayName }) => displayName)).toEqual([
      'Lena Ortiz',
    ])
    expect(metadata.labels).toHaveLength(2)
  })

  it('returns ordered board workflows to read-only workspace members', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    const workspaceId = fixtures.workspaces[0]?.id

    if (!viewerId || !workspaceId) {
      throw new Error('Expected viewer and workspace fixtures.')
    }

    const { gateway, tracer } = createGateway(new SimulatedNetwork(), viewerId)
    const metadata = await gateway.getBoardMetadata(workspaceId)

    expect(metadata.projects.map(({ project }) => project.name)).toEqual([
      'Field reliability',
      'Launch readiness',
    ])
    expect(
      metadata.projects.every(({ statuses }) =>
        statuses.every((status, index) => status.order === index),
      ),
    ).toBe(true)
    expect(tracer.read().at(-1)).toMatchObject({
      operation: 'board.metadata',
      phase: 'succeeded',
    })
  })

  it('rejects invalid creation references before committing data', async () => {
    const { fixtures, gateway, store } = createGateway()
    const project = fixtures.projects[0]
    const otherProjectStatus = fixtures.workflowStatuses.find(
      ({ projectId }) => projectId !== project?.id,
    )

    if (!project || !otherProjectStatus) {
      throw new Error('Expected multiple project workflows.')
    }

    const issueCount = store.read().data.issues.length
    await expect(
      gateway.createIssue({
        workspaceId: project.workspaceId,
        projectId: project.id,
        type: 'task',
        title: 'Invalid workflow issue',
        description: '',
        statusId: otherProjectStatus.id,
        priority: 'medium',
        assigneeId: null,
        parentIssueId: null,
        dueDate: null,
        labelIds: [],
      }),
    ).rejects.toBeInstanceOf(InvalidGatewayRequestError)
    expect(store.read().data.issues).toHaveLength(issueCount)
  })

  it('rejects direct issue creation attempts from a read-only actor', async () => {
    const fixtures = createAtlasFixtures()
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId
    const template = fixtures.issues[0]

    if (!viewerId || !template) {
      throw new Error('Expected read-only actor and issue fixtures.')
    }

    const { gateway } = createGateway(new SimulatedNetwork(), viewerId)

    await expect(
      gateway.createIssue({
        workspaceId: template.workspaceId,
        projectId: template.projectId,
        type: template.type,
        title: 'Unauthorized issue',
        description: '',
        statusId: template.statusId,
        priority: template.priority,
        assigneeId: null,
        parentIssueId: null,
        dueDate: null,
        labelIds: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenGatewayError)
  })

  it('excludes closed projects and rejects creation into them', async () => {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    const template = fixtures.issues[0]
    const adminId = fixtures.memberships.find(({ role }) => role === 'admin')?.userId

    if (!project || !template || !adminId) {
      throw new Error('Expected project, issue, and administrator fixtures.')
    }

    const closedFixtures = {
      ...fixtures,
      projects: fixtures.projects.map((candidate) =>
        candidate.id === project.id
          ? { ...candidate, status: 'completed' as const }
          : candidate,
      ),
    }
    const gateway = new MockAtlasGateway({
      actorId: adminId,
      store: new InMemoryDataStore(closedFixtures),
    })
    const metadata = await gateway.getIssueCreationMetadata(project.workspaceId)

    expect(metadata.projects.some(({ project: item }) => item.id === project.id)).toBe(
      false,
    )
    await expect(
      gateway.createIssue({
        workspaceId: template.workspaceId,
        projectId: template.projectId,
        type: template.type,
        title: 'Closed project work',
        description: '',
        statusId: template.statusId,
        priority: template.priority,
        assigneeId: null,
        parentIssueId: null,
        dueDate: null,
        labelIds: [],
      }),
    ).rejects.toBeInstanceOf(InvalidGatewayRequestError)
  })

  it('updates with revision checks and rejects stale mutations', async () => {
    const { fixtures, gateway, store } = createGateway()
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
    expect(store.read().data.auditEvents.at(-1)).toMatchObject({
      action: 'issue.updated',
      requestId: 'req_000001',
      metadata: {
        issueId: issue.id,
        fromRevision: issue.revision,
        toRevision: issue.revision + 1,
      },
    })
    await expect(
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { priority: 'low' },
      }),
    ).rejects.toBeInstanceOf(GatewayConflictError)
  })

  it('moves issues only within their project workflow and records activity', async () => {
    const { fixtures, gateway, store } = createGateway()
    const issue = fixtures.issues[0]
    const projectStatuses = fixtures.workflowStatuses.filter(
      ({ projectId }) => projectId === issue?.projectId,
    )
    const targetStatus = projectStatuses.find(({ id }) => id !== issue?.statusId)
    const foreignStatus = fixtures.workflowStatuses.find(
      ({ projectId }) => projectId !== issue?.projectId,
    )

    if (!issue || !targetStatus || !foreignStatus) {
      throw new Error('Expected issue and workflow fixtures.')
    }

    const moved = await gateway.updateIssue({
      id: issue.id,
      expectedRevision: issue.revision,
      changes: { statusId: targetStatus.id },
    })

    expect(moved.statusId).toBe(targetStatus.id)
    expect(store.read().data.activityEvents.at(-1)).toMatchObject({
      action: 'issue.status_changed',
      entityId: issue.id,
    })
    expect(store.read().data.activityEvents.at(-1)?.summary).toContain(
      targetStatus.name,
    )
    await expect(
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: moved.revision,
        changes: { statusId: foreignStatus.id },
      }),
    ).rejects.toBeInstanceOf(InvalidGatewayRequestError)
    expect(store.read().data.issues.find(({ id }) => id === issue.id)?.statusId).toBe(
      targetStatus.id,
    )
  })

  it('creates a comment with deterministic activity and audit records', async () => {
    const { fixtures, gateway, store } = createGateway()
    const issue = fixtures.issues[0]

    if (!issue) throw new Error('Expected a fixture issue.')

    const comment = await gateway.createComment({
      issueId: issue.id,
      body: '  Confirmed the rollback owner and escalation window.  ',
    })

    expect(comment).toMatchObject({
      issueId: issue.id,
      body: 'Confirmed the rollback owner and escalation window.',
      createdAt: '2026-02-01T08:00:00.000Z',
      editedAt: null,
    })
    const snapshot = store.read().data
    expect(snapshot.activityEvents.at(-1)).toMatchObject({
      entityId: issue.id,
      action: 'comment.created',
      summary: 'Added a comment.',
    })
    expect(snapshot.auditEvents.at(-1)).toMatchObject({
      requestId: 'req_000001',
      action: 'comment.created',
      outcome: 'succeeded',
      metadata: { issueId: issue.id, commentId: comment.id },
    })

    const activity = await gateway.getIssueActivity(issue.id)
    expect(activity.comments[0]).toEqual(comment)
    expect(activity.activityEvents[0]?.action).toBe('comment.created')
    expect(activity.users.some(({ id }) => id === comment.authorId)).toBe(true)
  })

  it('creates notifications at the mutation boundary for non-actor assignees', async () => {
    const { fixtures, gateway, store } = createGateway()
    const adminId = fixtures.memberships.find(({ role }) => role === 'admin')?.userId
    const issue = fixtures.issues.find(
      ({ assigneeId }) => assigneeId !== null && assigneeId !== adminId,
    )

    if (!issue?.assigneeId) {
      throw new Error('Expected an issue assigned to another fixture user.')
    }

    await gateway.createComment({ issueId: issue.id, body: 'Please review this update.' })
    expect(store.read().data.notifications.at(-1)).toMatchObject({
      recipientId: issue.assigneeId,
      issueId: issue.id,
      kind: 'comment',
      readAt: null,
    })

    const current = store.read().data.issues.find(({ id }) => id === issue.id)
    if (!current) throw new Error('Expected the issue after comment creation.')
    await gateway.updateIssue({
      id: current.id,
      expectedRevision: current.revision,
      changes: { priority: 'urgent' },
    })
    expect(store.read().data.notifications.at(-1)).toMatchObject({
      recipientId: issue.assigneeId,
      issueId: issue.id,
      kind: 'issue-update',
    })
  })

  it('rejects invalid and permission-bypassing comment submissions', async () => {
    const fixtures = createAtlasFixtures()
    const issue = fixtures.issues[0]
    const viewerId = fixtures.memberships.find(({ role }) => role === 'viewer')?.userId

    if (!issue || !viewerId) {
      throw new Error('Expected issue and viewer fixtures.')
    }

    const { gateway: adminGateway, store } = createGateway()
    const originalCommentCount = store.read().data.comments.length
    await expect(
      adminGateway.createComment({ issueId: issue.id, body: '   ' }),
    ).rejects.toBeInstanceOf(InvalidGatewayRequestError)
    expect(store.read().data.comments).toHaveLength(originalCommentCount)

    const { gateway: viewerGateway } = createGateway(
      new SimulatedNetwork(),
      viewerId,
    )
    await expect(
      viewerGateway.createComment({ issueId: issue.id, body: 'Bypass attempt' }),
    ).rejects.toBeInstanceOf(ForbiddenGatewayError)
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
      snapshot.activityEvents.some(
        ({ entityKind, entityId }) =>
          entityKind === 'issue' && entityId === issue.id,
      ),
    ).toBe(false)
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
