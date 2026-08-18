import { describe, expect, it } from 'vitest'

import { createLargeWorkspaceFixtures } from '../large-fixtures'
import { buildWorkspaceActivity } from './activity'
import { buildWorkspaceAnalytics } from './analytics'
import { queryProjectSummaries } from './project-summary'
import { isoDateTime } from '../../domain'

describe('large workspace gateway projections', () => {
  it('keeps portfolio, analytics, and activity projections consistent at scale', () => {
    const data = createLargeWorkspaceFixtures()
    const workspaceId = data.workspaces[0]?.id
    expect(workspaceId).toBeDefined()
    if (!workspaceId) return

    const summaries = [1, 2, 3].flatMap((number) =>
      queryProjectSummaries(data, {
        workspaceId,
        page: { number, size: 100 },
      }).items,
    )
    const analytics = buildWorkspaceAnalytics(
      data,
      { workspaceId, range: '90-days' },
      isoDateTime('2026-02-01T08:00:00.000Z'),
    )
    const activity = buildWorkspaceActivity(
      data,
      { workspaceId, page: { number: 2, size: 25 } },
      isoDateTime('2026-02-01T08:00:00.000Z'),
    )

    expect(summaries).toHaveLength(300)
    expect(summaries.reduce((total, summary) => total + summary.totalIssues, 0))
      .toBe(data.issues.length)
    expect(summaries.reduce((total, summary) => total + summary.openIssues, 0))
      .toBe(analytics.openIssues)
    expect(summaries.reduce((total, summary) => total + summary.completedIssues, 0))
      .toBe(analytics.completedIssues)
    expect(analytics.projects).toHaveLength(data.projects.length)
    expect(analytics.projects.reduce((total, project) => total + project.totalIssues, 0))
      .toBe(data.issues.length)

    expect(activity.events).toMatchObject({
      pageNumber: 2,
      pageSize: 25,
      pageCount: 200,
      totalItems: data.activityEvents.length,
    })
    expect(activity.events.items).toHaveLength(25)
    expect(activity.events.items.every(({ actor, target }) =>
      actor.displayName.length > 0 && target.label.length > 0,
    )).toBe(true)
    expect(activity.actors.reduce((total, actor) => total + actor.count, 0))
      .toBe(data.activityEvents.length)
    expect(activity.actions.reduce((total, action) => total + action.count, 0))
      .toBe(data.activityEvents.length)
  })
})
