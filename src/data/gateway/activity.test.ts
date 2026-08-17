import { describe, expect, it } from 'vitest'

import { createAtlasFixtures } from '../fixtures'
import { activityEventId, isoDateTime, workspaceInvitationId } from '../../domain'
import { buildWorkspaceActivity } from './activity'
import { InvalidGatewayRequestError } from './errors'

describe('buildWorkspaceActivity', () => {
  it('filters and paginates a deterministic workspace timeline with facets', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    const source = data.activityEvents[0]
    const project = data.projects[0]
    if (!workspaceId || !source || !project) throw new Error('Expected activity fixtures.')
    const activityEvents = [
      source,
      {
        ...source,
        id: activityEventId('activity_project_history_001'),
        entityKind: 'project' as const,
        entityId: project.id,
        action: 'project.updated',
        occurredAt: isoDateTime('2026-02-02T10:00:00.000Z'),
        summary: 'Updated project delivery details.',
      },
      {
        ...source,
        id: activityEventId('activity_project_history_002'),
        entityKind: 'project' as const,
        entityId: project.id,
        action: 'project.updated',
        occurredAt: isoDateTime('2026-02-03T10:00:00.000Z'),
        summary: 'Updated project delivery status.',
      },
    ]

    const report = buildWorkspaceActivity(
      { ...data, activityEvents },
      {
        workspaceId,
        action: 'project.updated',
        entityKind: 'project',
        page: { number: 1, size: 1 },
      },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(report.events).toMatchObject({ totalItems: 2, pageCount: 2 })
    expect(report.events.items[0]).toMatchObject({
      target: { label: `OPS · ${project.name}`, href: `/projects/${project.id}` },
      event: { summary: 'Updated project delivery status.' },
    })
    expect(report.actions).toContainEqual({ value: 'project.updated', count: 2 })
    expect(report.entityKinds).toContainEqual({ value: 'project', count: 2 })
    expect(report.actors[0]).toMatchObject({ label: 'Omar Haddad', count: 3 })
  })

  it('supports date/entity filters and removed-entity history', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    const source = data.activityEvents[0]
    if (!workspaceId || !source) throw new Error('Expected activity fixtures.')
    const removed = {
      ...source,
      id: activityEventId('activity_removed_issue_001'),
      entityId: 'issue_removed_001',
      occurredAt: isoDateTime('2026-02-04T10:00:00.000Z'),
    }
    const report = buildWorkspaceActivity(
      { ...data, activityEvents: [...data.activityEvents, removed] },
      {
        workspaceId,
        entityId: removed.entityId,
        occurredFrom: removed.occurredAt,
        occurredTo: removed.occurredAt,
      },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(report.events.items[0]).toMatchObject({
      target: { label: 'Removed issue', href: null },
    })
  })

  it('resolves deep-link targets for every supported activity entity kind', () => {
    const data = createAtlasFixtures()
    const workspace = data.workspaces[0]
    const source = data.activityEvents[0]
    const project = data.projects[0]
    const issue = data.issues[0]
    const comment = data.comments[0]
    const membership = data.memberships[0]
    if (!workspace || !source || !project || !issue || !comment || !membership) {
      throw new Error('Expected complete activity target fixtures.')
    }
    const invitation = {
      id: workspaceInvitationId('invite_activity_target_001'),
      workspaceId: workspace.id,
      email: 'activity@example.com',
      role: 'member' as const,
      state: 'pending' as const,
      invitedById: source.actorId,
      createdAt: isoDateTime('2026-02-01T09:00:00.000Z'),
      expiresAt: isoDateTime('2026-02-08T09:00:00.000Z'),
      lastSentAt: isoDateTime('2026-02-01T09:00:00.000Z'),
      acceptedAt: null,
      revokedAt: null,
      revision: 1,
    }
    const targets = [
      ['workspace', workspace.id],
      ['project', project.id],
      ['issue', issue.id],
      ['comment', comment.id],
      ['member', membership.id],
      ['invitation', invitation.id],
    ] as const
    const activityEvents = targets.map(([entityKind, entityId], index) => ({
      ...source,
      id: activityEventId(`activity_target_${index.toString().padStart(3, '0')}`),
      entityKind,
      entityId,
    }))

    const report = buildWorkspaceActivity(
      { ...data, workspaceInvitations: [invitation], activityEvents },
      { workspaceId: workspace.id },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(Object.fromEntries(
      report.events.items.map(({ event, target }) => [event.entityKind, target.href]),
    )).toEqual({
      workspace: '/',
      project: `/projects/${project.id}`,
      issue: `/issues/${issue.id}`,
      comment: `/issues/${issue.id}`,
      member: '/administration',
      invitation: '/administration',
    })
  })

  it('rejects malformed filters and inverted ranges', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    if (!workspaceId) throw new Error('Expected a workspace fixture.')
    const generatedAt = isoDateTime('2026-02-10T12:00:00.000Z')

    expect(() => buildWorkspaceActivity(data, { workspaceId, action: ' issue.updated' }, generatedAt))
      .toThrow(InvalidGatewayRequestError)
    expect(() => buildWorkspaceActivity(data, {
      workspaceId,
      occurredFrom: generatedAt,
      occurredTo: isoDateTime('2026-02-01T12:00:00.000Z'),
    }, generatedAt)).toThrow(InvalidGatewayRequestError)
  })
})
