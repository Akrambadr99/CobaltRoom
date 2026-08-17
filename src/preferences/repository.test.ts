import { describe, expect, it, vi } from 'vitest'

import { PreferencePersistenceError, UserPreferenceRepository } from './repository'
import { MemoryPreferenceStorage, type PreferenceStorage } from './storage'
import { FixedClock } from '../data'
import { issueWorkspaceDefaults } from '../features/issues/issue-workspace-state'
import { isoDateTime } from '../domain'

const storageKey = 'atlas-ops:test:preferences'

function createRepository(storage: PreferenceStorage = new MemoryPreferenceStorage()) {
  return new UserPreferenceRepository({
    storage,
    storageKey,
    clock: new FixedClock(isoDateTime('2026-02-01T08:00:00.000Z')),
    idFactory: () => 'view_test_001',
  })
}

describe('UserPreferenceRepository', () => {
  it('persists private views and notifies subscribers with stable snapshots', () => {
    const storage = new MemoryPreferenceStorage()
    const repository = createRepository(storage)
    const listener = vi.fn()
    const unsubscribe = repository.subscribe(listener)

    const saved = repository.saveIssueView('  Urgent work  ', {
      ...issueWorkspaceDefaults,
      priority: 'urgent',
      page: 4,
    })
    repository.setIssuePageSize(10)

    expect(saved).toMatchObject({
      id: 'view_test_001',
      name: 'Urgent work',
      state: { priority: 'urgent', page: 1 },
      createdAt: '2026-02-01T08:00:00.000Z',
    })
    expect(listener).toHaveBeenCalledTimes(2)
    expect(createRepository(storage).getSnapshot()).toMatchObject({
      issuePageSize: 10,
      savedIssueViews: [{ name: 'Urgent work' }],
    })

    unsubscribe()
    repository.deleteIssueView(saved.id)
    expect(listener).toHaveBeenCalledTimes(2)
    expect(repository.getSnapshot().savedIssueViews).toHaveLength(0)
  })

  it('rejects duplicate names and invalid identifiers without changing state', () => {
    const repository = createRepository()
    repository.saveIssueView('Triage', issueWorkspaceDefaults)

    expect(() =>
      repository.saveIssueView('triage', issueWorkspaceDefaults),
    ).toThrow('Saved view names must be unique.')
    expect(repository.getSnapshot().savedIssueViews).toHaveLength(1)

    const invalidIdRepository = new UserPreferenceRepository({
      storage: new MemoryPreferenceStorage(),
      storageKey,
      idFactory: () => 'unsafe-id',
    })
    expect(() =>
      invalidIdRepository.saveIssueView('Valid name', issueWorkspaceDefaults),
    ).toThrow('Saved view identifiers must use the view_ prefix.')
    expect(invalidIdRepository.getSnapshot().savedIssueViews).toHaveLength(0)
  })

  it('keeps the prior snapshot when durable storage rejects a write', () => {
    const storage: PreferenceStorage = {
      get: () => null,
      set: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError')
      },
    }
    const repository = createRepository(storage)

    expect(() => {
      repository.setIssuePageSize(25)
    }).toThrow(
      PreferencePersistenceError,
    )
    expect(repository.getSnapshot().issuePageSize).toBe(5)
  })
})
