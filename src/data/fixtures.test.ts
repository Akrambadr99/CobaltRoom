import { describe, expect, it } from 'vitest'

import { FixedClock } from './clock'
import { createAtlasFixtures } from './fixtures'
import { assertValidSnapshot } from './snapshot-validation'
import { isoDateTime } from '../domain'

describe('Atlas fixtures', () => {
  it('produces a realistic, invariant-safe snapshot', () => {
    const fixtures = createAtlasFixtures()

    expect(() => {
      assertValidSnapshot(fixtures)
    }).not.toThrow()
    expect(fixtures.workspaces).toHaveLength(1)
    expect(fixtures.projects).toHaveLength(2)
    expect(fixtures.issues).toHaveLength(6)
    expect(fixtures.issues.some(({ parentIssueId }) => parentIssueId !== null)).toBe(
      true,
    )
    expect(fixtures.issueRelations).toHaveLength(2)
  })

  it('is byte-for-byte deterministic for equivalent inputs', () => {
    expect(createAtlasFixtures()).toEqual(createAtlasFixtures())
  })

  it('uses an injected clock without consulting wall time', () => {
    const clock = new FixedClock(isoDateTime('2030-05-01T12:30:00.000Z'))
    const fixtures = createAtlasFixtures({ clock })

    expect(fixtures.workspaces[0]?.createdAt).toBe('2030-05-01T12:30:00.000Z')
    expect(fixtures.issues.every(({ createdAt }) => createdAt === clock.now())).toBe(
      true,
    )
  })
})
