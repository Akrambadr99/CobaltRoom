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
  })
})
