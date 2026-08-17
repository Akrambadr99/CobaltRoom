import { describe, expect, it } from 'vitest'

import {
  createLargeWorkspaceFixtures,
  largeWorkspaceFixtureDefaults,
} from './large-fixtures'
import { assertValidSnapshot } from './snapshot-validation'

describe('large workspace fixtures', () => {
  it('builds an invariant-safe production-scale workspace', () => {
    const snapshot = createLargeWorkspaceFixtures()

    expect(() => {
      assertValidSnapshot(snapshot)
    }).not.toThrow()
    expect(snapshot.projects).toHaveLength(
      largeWorkspaceFixtureDefaults.projectCount,
    )
    expect(snapshot.issues).toHaveLength(
      largeWorkspaceFixtureDefaults.issueCount,
    )
    expect(snapshot.users).toHaveLength(
      largeWorkspaceFixtureDefaults.memberCount,
    )
    expect(snapshot.workflowStatuses).toHaveLength(
      largeWorkspaceFixtureDefaults.projectCount * 4,
    )
    expect(snapshot.projectMembers).toHaveLength(
      largeWorkspaceFixtureDefaults.projectCount * 4,
    )
    expect(snapshot.projectSubscriptions).toHaveLength(100)
    expect(snapshot.issueSubscriptions).toHaveLength(1_250)
    expect(snapshot.comments).toHaveLength(1_000)
    expect(snapshot.commentMentions).toHaveLength(500)
    expect(snapshot.activityEvents).toHaveLength(
      largeWorkspaceFixtureDefaults.activityEventCount,
    )
    expect(snapshot.auditEvents).toHaveLength(
      largeWorkspaceFixtureDefaults.auditEventCount,
    )
    expect(snapshot.notifications).toHaveLength(
      largeWorkspaceFixtureDefaults.notificationCount,
    )
    expect(snapshot.notificationPreferences).toHaveLength(
      largeWorkspaceFixtureDefaults.memberCount,
    )

    const issueCounts = snapshot.projects.map(
      (project) =>
        snapshot.issues.filter(({ projectId }) => projectId === project.id).length,
    )
    expect(Math.max(...issueCounts) - Math.min(...issueCounts)).toBeLessThanOrEqual(1)
  })

  it('reproduces identities and distributions for the same configuration', () => {
    const options = {
      projectCount: 5,
      issueCount: 23,
      memberCount: 12,
      activityEventCount: 17,
      auditEventCount: 19,
      notificationCount: 13,
      invitationCount: 7,
      namespace: 'repeatable',
    } as const
    const first = createLargeWorkspaceFixtures(options)
    const second = createLargeWorkspaceFixtures(options)

    expect(second).toEqual(first)
    expect(first.projects.map(({ key }) => key)).toEqual([
      'P0000',
      'P0001',
      'P0002',
      'P0003',
      'P0004',
    ])
    expect(first.issues.filter(({ projectId }) => projectId === first.projects[0]?.id))
      .toHaveLength(5)
  })

  it('rejects configurations that cannot produce valid connected data', () => {
    expect(() =>
      createLargeWorkspaceFixtures({ memberCount: 7 }),
    ).toThrow('at least one project and eight members')
    expect(() =>
      createLargeWorkspaceFixtures({
        issueCount: 0,
        activityEventCount: 1,
        notificationCount: 0,
      }),
    ).toThrow('require at least one issue')
    expect(() =>
      createLargeWorkspaceFixtures({ projectCount: -1 }),
    ).toThrow('non-negative safe integers')
  })
})
