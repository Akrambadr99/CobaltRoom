import { describe, expect, it } from 'vitest'

import {
  parseProjectWorkspaceState,
  serializeProjectWorkspaceState,
} from './project-workspace-state'

describe('project workspace URL state', () => {
  it('round-trips supported filters and pagination', () => {
    const state = parseProjectWorkspaceState(
      new URLSearchParams('q=reliability&status=active&page=3'),
    )

    expect(state).toEqual({ search: 'reliability', status: 'active', page: 3 })
    expect(serializeProjectWorkspaceState(state).toString()).toBe(
      'q=reliability&status=active&page=3',
    )
  })

  it('fails closed to safe defaults for malformed saved URLs', () => {
    expect(
      parseProjectWorkspaceState(
        new URLSearchParams('status=deleted&page=-4&q=%20%20launch%20%20'),
      ),
    ).toEqual({ search: 'launch', status: null, page: 1 })
  })
})
