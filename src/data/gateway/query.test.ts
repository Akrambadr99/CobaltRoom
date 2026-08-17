import { describe, expect, it } from 'vitest'

import { InvalidGatewayRequestError } from './errors'
import { queryIssues } from './query'
import { createAtlasFixtures } from '../fixtures'

describe('issue querying', () => {
  const fixtures = createAtlasFixtures()
  const workspaceId = fixtures.workspaces[0]?.id

  if (!workspaceId) {
    throw new Error('Expected a fixture workspace.')
  }

  it('combines workspace, project, priority, and text filters', () => {
    const projectId = fixtures.projects[0]?.id

    if (!projectId) {
      throw new Error('Expected a fixture project.')
    }

    const result = queryIssues(fixtures.issues, {
      filters: {
        workspaceId,
        projectIds: [projectId],
        priorities: ['urgent', 'high'],
        search: 'launch',
      },
    })

    expect(result.items.map(({ title }) => title)).toEqual([
      'Publish the launch readiness brief',
      'Complete launch risk review',
    ])
  })

  it('supports explicit unassigned filtering', () => {
    const result = queryIssues(fixtures.issues, {
      filters: {
        workspaceId,
        assigneeIds: [],
        includeUnassigned: true,
      },
    })

    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.title).toBe('Tune restart anomaly alerts')
  })

  it('sorts priority deterministically and preserves input order for ties', () => {
    const result = queryIssues(fixtures.issues, {
      filters: { workspaceId },
      sort: { field: 'priority', direction: 'ascending' },
    })

    expect(result.items.map(({ priority }) => priority)).toEqual([
      'urgent',
      'urgent',
      'high',
      'high',
      'medium',
      'low',
    ])
    expect(result.items.slice(0, 2).map(({ number }) => number)).toEqual([1, 1])
  })

  it('returns complete pagination metadata for pages beyond the first', () => {
    const result = queryIssues(fixtures.issues, {
      filters: { workspaceId },
      sort: { field: 'title', direction: 'ascending' },
      page: { number: 2, size: 2 },
    })

    expect(result).toMatchObject({
      pageNumber: 2,
      pageSize: 2,
      pageCount: 3,
      totalItems: 6,
    })
    expect(result.items).toHaveLength(2)
  })

  it.each([
    { number: 0, size: 25 },
    { number: 1.5, size: 25 },
    { number: 1, size: 0 },
    { number: 1, size: 101 },
  ])('rejects invalid pagination', (page) => {
    expect(() => queryIssues(fixtures.issues, { filters: { workspaceId }, page })).toThrow(
      InvalidGatewayRequestError,
    )
  })
})
