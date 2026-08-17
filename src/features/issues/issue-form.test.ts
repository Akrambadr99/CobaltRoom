import { describe, expect, it } from 'vitest'

import { validateIssueEditDraft } from './issue-form'

describe('issue edit validation', () => {
  it('normalizes valid editable values', () => {
    expect(
      validateIssueEditDraft({
        title: '  Resolve launch dependency  ',
        description: '  Confirm the owner.  ',
        priority: 'high',
        dueDate: '2026-03-04',
      }),
    ).toEqual({
      changes: {
        title: 'Resolve launch dependency',
        description: 'Confirm the owner.',
        priority: 'high',
        dueDate: '2026-03-04',
      },
      errors: {},
    })
  })

  it('rejects blank titles and impossible dates', () => {
    const result = validateIssueEditDraft({
      title: '   ',
      description: '',
      priority: 'none',
      dueDate: '2026-02-30',
    })

    expect(result.changes).toBeNull()
    expect(result.errors).toEqual({
      title: 'Enter an issue title.',
      dueDate: 'Enter a valid calendar date.',
    })
  })
})
