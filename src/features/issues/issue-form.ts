import type { MutableIssueFields } from '../../data'
import { isoDate, type IssuePriority } from '../../domain'

export interface IssueEditDraft {
  readonly title: string
  readonly description: string
  readonly priority: IssuePriority
  readonly dueDate: string
}

export interface IssueEditValidation {
  readonly changes: Partial<MutableIssueFields> | null
  readonly errors: Readonly<Partial<Record<keyof IssueEditDraft, string>>>
}

export function validateIssueEditDraft(
  draft: IssueEditDraft,
): IssueEditValidation {
  const errors: Partial<Record<keyof IssueEditDraft, string>> = {}
  const title = draft.title.trim()
  const description = draft.description.trim()

  if (title.length === 0) errors.title = 'Enter an issue title.'
  else if (title.length > 160) errors.title = 'Keep the title to 160 characters.'

  if (description.length > 5_000) {
    errors.description = 'Keep the description to 5,000 characters.'
  }

  let dueDate = null
  if (draft.dueDate) {
    try {
      dueDate = isoDate(draft.dueDate)
    } catch {
      errors.dueDate = 'Enter a valid calendar date.'
    }
  }

  return {
    changes:
      Object.keys(errors).length === 0
        ? { title, description, priority: draft.priority, dueDate }
        : null,
    errors,
  }
}
