import { describe, expect, it } from 'vitest'

import { DeterministicIdGenerator } from './id-generator'

describe('DeterministicIdGenerator', () => {
  it('creates stable, type-prefixed sequences per entity scope', () => {
    const ids = new DeterministicIdGenerator('atlas')

    expect(ids.issue('launch')).toBe('issue_atlas_launch_001')
    expect(ids.issue('launch')).toBe('issue_atlas_launch_002')
    expect(ids.issue('reliability')).toBe('issue_atlas_reliability_001')
    expect(ids.project('launch')).toBe('prj_atlas_launch_001')
    expect(ids.notification('launch')).toBe('notification_atlas_launch_001')
    expect(ids.notificationPreference('launch')).toBe(
      'notification_pref_atlas_launch_001',
    )
  })

  it.each(['Atlas', 'atlas-ops', '', '_atlas'])(
    'rejects an invalid namespace',
    (namespace) => {
      expect(() => new DeterministicIdGenerator(namespace)).toThrow(TypeError)
    },
  )

  it('rejects invalid scopes before advancing a sequence', () => {
    const ids = new DeterministicIdGenerator('atlas')

    expect(() => ids.user('Product Lead')).toThrow(TypeError)
    expect(ids.user('product_lead')).toBe('usr_atlas_product_lead_001')
  })
})
