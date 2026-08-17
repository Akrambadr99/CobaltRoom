import { describe, expect, it } from 'vitest'

import { createAtlasFixtures } from '../fixtures'
import { InvalidGatewayRequestError } from './errors'
import { queryProjectSummaries } from './project-summary'

describe('queryProjectSummaries', () => {
  it('filters projects and computes workflow-aware issue totals', () => {
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture.')

    const result = queryProjectSummaries(fixtures, {
      workspaceId: workspace.id,
      search: 'REL',
      statuses: ['active'],
    })

    expect(result.totalItems).toBe(1)
    expect(result.items[0]).toMatchObject({
      project: { key: 'REL', name: 'Field reliability' },
      totalIssues: 3,
      openIssues: 2,
      completedIssues: 1,
    })
  })

  it('sorts deterministically before applying server-style pages', () => {
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture.')

    const result = queryProjectSummaries(fixtures, {
      workspaceId: workspace.id,
      page: { number: 2, size: 1 },
    })

    expect(result).toMatchObject({
      pageNumber: 2,
      pageCount: 2,
      totalItems: 2,
    })
    expect(result.items[0]?.project.name).toBe('Launch readiness')
  })

  it('rejects invalid pagination at the gateway boundary', () => {
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture.')

    expect(() =>
      queryProjectSummaries(fixtures, {
        workspaceId: workspace.id,
        page: { number: 0, size: 12 },
      }),
    ).toThrow(InvalidGatewayRequestError)
  })

  it('rejects oversized search input at the gateway boundary', () => {
    const fixtures = createAtlasFixtures()
    const workspace = fixtures.workspaces[0]
    if (!workspace) throw new Error('Expected a workspace fixture.')

    expect(() =>
      queryProjectSummaries(fixtures, {
        workspaceId: workspace.id,
        search: 'x'.repeat(101),
      }),
    ).toThrow('Project searches may not exceed 100 characters.')
  })
})
