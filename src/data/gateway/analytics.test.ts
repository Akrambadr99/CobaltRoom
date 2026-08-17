import { describe, expect, it } from 'vitest'

import { buildWorkspaceAnalytics } from './analytics'
import { createAtlasFixtures } from '../fixtures'
import { isoDateTime } from '../../domain'

describe('buildWorkspaceAnalytics', () => {
  it('derives deterministic workspace and project aggregates from canonical state', () => {
    const fixtures = createAtlasFixtures()
    const workspaceId = fixtures.workspaces[0]?.id
    if (!workspaceId) throw new Error('Expected a workspace fixture.')

    const analytics = buildWorkspaceAnalytics(
      fixtures,
      { workspaceId, range: 'all-time' },
      isoDateTime('2026-02-10T12:00:00.000Z'),
    )

    expect(analytics).toMatchObject({
      range: 'all-time',
      rangeStart: '2026-01-01',
      createdInRange: 6,
      updatedInRange: 6,
      activeProjects: 2,
      totalIssues: 6,
      openIssues: 4,
      completedIssues: 2,
      urgentOpenIssues: 2,
      overdueIssues: 3,
      unassignedOpenIssues: 0,
    })
    expect(analytics.priorities).toEqual([
      { value: 'urgent', count: 2 },
      { value: 'high', count: 2 },
      { value: 'medium', count: 1 },
      { value: 'low', count: 1 },
      { value: 'none', count: 0 },
    ])
    expect(analytics.projects).toHaveLength(2)
    expect(analytics.projects[0]).toMatchObject({
      projectName: 'Field reliability',
      totalIssues: 3,
      completedIssues: 1,
      completionPercent: 33,
    })
    expect(analytics.issueFlow).toEqual([
      { periodStart: '2026-01-01', createdIssues: 6, updatedIssues: 6 },
      { periodStart: '2026-02-01', createdIssues: 0, updatedIssues: 0 },
    ])
  })
})
