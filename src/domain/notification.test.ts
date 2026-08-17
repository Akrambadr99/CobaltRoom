import { describe, expect, it } from 'vitest'

import { notificationCategory, type NotificationKind } from './notification'

describe('notificationCategory', () => {
  it('maps notification kinds into stable user-facing categories', () => {
    const kinds: readonly NotificationKind[] = [
      'assignment',
      'comment',
      'issue-update',
      'project-update',
      'workspace-administration',
      'governance',
    ]

    expect(kinds.map(notificationCategory)).toEqual([
      'work',
      'collaboration',
      'work',
      'work',
      'administration',
      'governance',
    ])
  })
})
