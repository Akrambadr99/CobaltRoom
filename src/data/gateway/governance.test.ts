import { describe, expect, it } from 'vitest'

import { createAtlasFixtures } from '../fixtures'
import { buildGovernanceReport } from './governance'
import { InvalidGatewayRequestError } from './errors'
import { isoDateTime } from '../../domain'

describe('buildGovernanceReport', () => {
  it('filters and paginates authoritative audit entries', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    if (!workspaceId) throw new Error('Expected a fixture workspace.')

    const report = buildGovernanceReport(
      data,
      { workspaceId, outcome: 'succeeded', page: { number: 1, size: 2 } },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(report.totalEvents).toBe(data.auditEvents.length)
    expect(report.events.items).toHaveLength(2)
    expect(report.events.totalItems).toBe(report.succeededEvents)
    expect(report.actions.map(({ value }) => value)).toContain('fixtures.created')
  })

  it('rejects invalid pagination and ambiguous action filters', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    if (!workspaceId) throw new Error('Expected a fixture workspace.')

    expect(() =>
      buildGovernanceReport(
        data,
        { workspaceId, page: { number: 0, size: 25 } },
        isoDateTime('2026-02-10T12:00:00.000Z'),
      ),
    ).toThrow(InvalidGatewayRequestError)
    expect(() =>
      buildGovernanceReport(
        data,
        { workspaceId, action: ' fixtures.created ' },
        isoDateTime('2026-02-10T12:00:00.000Z'),
      ),
    ).toThrow(InvalidGatewayRequestError)
    expect(() =>
      buildGovernanceReport(
        data,
        {
          workspaceId,
          occurredFrom: isoDateTime('2026-02-10T12:00:00.000Z'),
          occurredTo: isoDateTime('2026-02-01T12:00:00.000Z'),
        },
        isoDateTime('2026-02-10T12:00:00.000Z'),
      ),
    ).toThrow(InvalidGatewayRequestError)
  })

  it('filters authoritative actor, entity, request, and date dimensions', () => {
    const data = createAtlasFixtures()
    const workspaceId = data.workspaces[0]?.id
    const project = data.projects[0]
    const actor = data.memberships.find(({ role }) => role === 'admin')
    const source = data.auditEvents.find(({ actorId }) => actorId === actor?.userId)
    if (!workspaceId || !project || !actor || !source) {
      throw new Error('Expected advanced governance fixtures.')
    }
    const enriched = {
      ...data,
      auditEvents: data.auditEvents.map((event) =>
        event.id === source.id
          ? { ...event, metadata: { ...event.metadata, projectId: project.id } }
          : event,
      ),
    }
    const report = buildGovernanceReport(
      enriched,
      {
        workspaceId,
        actor: actor.userId,
        entityId: project.id,
        requestId: source.requestId,
        occurredFrom: source.occurredAt,
        occurredTo: source.occurredAt,
      },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(report.events.totalItems).toBe(1)
    expect(report.events.items[0]).toMatchObject({
      actorName: 'Omar Haddad',
      entityId: project.id,
      event: { requestId: source.requestId },
    })
    expect(report.exportRows[0]).toMatchObject({
      actor: 'Omar Haddad',
      entityId: project.id,
      requestId: source.requestId,
    })
    expect(report.actors.map(({ label }) => label)).toEqual([
      'Omar Haddad',
      'System',
      'Theo Martin',
    ])
  })
})
