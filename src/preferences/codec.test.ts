import { describe, expect, it } from 'vitest'

import {
  decodeUserPreferences,
  encodeUserPreferences,
  serializeSavedViewState,
} from './codec'
import { defaultUserPreferences } from './types'
import { issueWorkspaceDefaults } from '../features/issues/issue-workspace-state'
import { isoDateTime, projectId } from '../domain'

describe('user preference codec', () => {
  it('round-trips version three preferences with canonical saved-view state', () => {
    const preferences = {
      schemaVersion: 3 as const,
      issuePageSize: 10 as const,
      savedIssueViews: [
        {
          id: 'view_reliability',
          name: 'Reliability queue',
          state: {
            ...issueWorkspaceDefaults,
            search: 'restart',
            projectId: projectId('prj_reliability'),
            priority: 'high' as const,
            page: 8,
          },
          createdAt: isoDateTime('2026-02-01T08:00:00.000Z'),
          updatedAt: isoDateTime('2026-02-01T08:00:00.000Z'),
        },
      ],
      dashboardWidgets: ['overdue', 'total-issues'] as const,
    }

    const decoded = decodeUserPreferences(encodeUserPreferences(preferences))
    const view = preferences.savedIssueViews[0]
    if (!view) throw new Error('Expected saved view fixture.')

    expect(decoded).toEqual({
      ...preferences,
      savedIssueViews: [{ ...preferences.savedIssueViews[0], state: {
        ...preferences.savedIssueViews[0]?.state,
        page: 1,
      } }],
    })
    expect(serializeSavedViewState(view.state)).not.toContain(
      'page=',
    )
  })

  it('migrates version one data and discards malformed persisted entries', () => {
    const migrated = decodeUserPreferences(
      JSON.stringify({
        schemaVersion: 1,
        pageSize: 25,
        views: [
          {
            id: 'view_legacy',
            name: ' Legacy urgent ',
            query: 'priority=urgent&page=99',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-02T00:00:00.000Z',
          },
          {
            id: '<script>',
            name: 'Unsafe',
            query: 'q=unsafe',
            createdAt: 'not-a-date',
            updatedAt: 'not-a-date',
          },
        ],
      }),
    )

    expect(migrated.issuePageSize).toBe(25)
    expect(migrated.savedIssueViews).toHaveLength(1)
    expect(migrated.savedIssueViews[0]).toMatchObject({
      id: 'view_legacy',
      name: 'Legacy urgent',
      state: { priority: 'urgent', page: 1 },
    })
    expect(migrated.dashboardWidgets).toEqual([
      'active-projects',
      'total-issues',
      'urgent-open',
    ])
  })

  it('migrates version two and rejects unsupported or empty widget layouts', () => {
    const migrated = decodeUserPreferences(
      JSON.stringify({
        schemaVersion: 2,
        issuePageSize: 10,
        savedIssueViews: [],
      }),
    )
    expect(migrated.dashboardWidgets).toEqual(defaultUserPreferences.dashboardWidgets)

    const decoded = decodeUserPreferences(
      JSON.stringify({
        schemaVersion: 3,
        issuePageSize: 5,
        savedIssueViews: [],
        dashboardWidgets: ['overdue', 'overdue', '<script>'],
      }),
    )
    expect(decoded.dashboardWidgets).toEqual(['overdue'])
  })

  it('fails closed for corrupt, oversized, and unknown-version payloads', () => {
    expect(decodeUserPreferences('{broken')).toEqual(defaultUserPreferences)
    expect(decodeUserPreferences('x'.repeat(100_001))).toEqual(
      defaultUserPreferences,
    )
    expect(
      decodeUserPreferences(JSON.stringify({ schemaVersion: 99 })),
    ).toEqual(defaultUserPreferences)
  })
})
