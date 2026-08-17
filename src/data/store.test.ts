import { describe, expect, it } from 'vitest'

import { createAtlasFixtures } from './fixtures'
import { DataIntegrityError } from './snapshot-validation'
import { InMemoryDataStore, StaleSnapshotError } from './store'
import { userId } from '../domain'

describe('InMemoryDataStore', () => {
  it('isolates stored state from caller-owned snapshots', () => {
    const seed = createAtlasFixtures()
    const store = new InMemoryDataStore(seed)
    const firstRead = store.read()
    const [firstProject, ...remainingProjects] = firstRead.data.projects

    if (!firstProject) {
      throw new Error('Expected the fixture project.')
    }

    const changedProject = {
      ...firstProject,
      name: 'Locally changed name',
    }
    const callerOwnedSnapshot = {
      ...firstRead.data,
      projects: [changedProject, ...remainingProjects],
    }

    expect(store.read().data.projects[0]?.name).toBe('Launch readiness')
    expect(callerOwnedSnapshot.projects[0]?.name).toBe('Locally changed name')
  })

  it('commits valid snapshots atomically and increments the version', () => {
    const store = new InMemoryDataStore(createAtlasFixtures())
    const current = store.read()
    const [firstProject, ...remainingProjects] = current.data.projects

    if (!firstProject) {
      throw new Error('Expected the fixture project.')
    }

    const changedProject = {
      ...firstProject,
      name: 'Launch command center',
    }
    const nextData = {
      ...current.data,
      projects: [changedProject, ...remainingProjects],
    }

    const committed = store.commit(current.version, nextData)

    expect(committed.version).toBe(1)
    expect(committed.data.projects[0]?.name).toBe('Launch command center')
    expect(store.read()).toEqual(committed)
  })

  it('rejects stale concurrent writes without changing stored data', () => {
    const store = new InMemoryDataStore(createAtlasFixtures())
    const firstReader = store.read()
    const secondReader = store.read()

    store.commit(firstReader.version, firstReader.data)

    expect(() => store.commit(secondReader.version, secondReader.data)).toThrow(
      StaleSnapshotError,
    )
    expect(store.read().version).toBe(1)
  })

  it('rejects invalid seeds and invalid commits', () => {
    const seed = createAtlasFixtures()
    const [workspace] = seed.workspaces

    if (!workspace) {
      throw new Error('Expected the fixture workspace.')
    }

    const duplicateWorkspace = {
      ...seed,
      workspaces: [...seed.workspaces, workspace],
    }

    expect(() => new InMemoryDataStore(duplicateWorkspace)).toThrow(
      DataIntegrityError,
    )

    const store = new InMemoryDataStore(seed)
    const current = store.read()
    const orphanedIssues = {
      ...current.data,
      workflowStatuses: [],
    }

    expect(() => store.commit(current.version, orphanedIssues)).toThrow()
    expect(store.read().version).toBe(0)
  })

  it('rejects activity and audit records with orphaned actors', () => {
    const seed = createAtlasFixtures()
    const activity = seed.activityEvents[0]
    const audit = seed.auditEvents[0]

    if (!activity || !audit) throw new Error('Expected history fixtures.')

    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          activityEvents: [
            { ...activity, actorId: userId('usr_missing_activity_actor') },
          ],
        }),
    ).toThrow(DataIntegrityError)
    expect(
      () =>
        new InMemoryDataStore({
          ...seed,
          auditEvents: [
            { ...audit, actorId: userId('usr_missing_audit_actor') },
          ],
        }),
    ).toThrow(DataIntegrityError)
  })
})
