import { describe, expect, it } from 'vitest'

import {
  createInitialIssueDraft,
  validateIssueCreateDraft,
  validateIssueEditDraft,
} from './issue-form'
import { createAtlasFixtures } from '../../data'

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

describe('issue creation validation', () => {
  function createMetadata() {
    const fixtures = createAtlasFixtures()
    const project = fixtures.projects[0]
    const workspace = fixtures.workspaces[0]

    if (!project || !workspace) throw new Error('Expected project fixtures.')

    return {
      workspace,
      metadata: {
        projects: [
          {
            project,
            statuses: fixtures.workflowStatuses.filter(
              ({ projectId }) => projectId === project.id,
            ),
            assignees: fixtures.users.filter(({ id }) =>
              fixtures.projectMembers.some(
                ({ projectId, userId }) =>
                  projectId === project.id && userId === id,
              ),
            ),
          },
        ],
        labels: fixtures.labels,
      },
    }
  }

  it('creates a canonical gateway input from valid metadata-backed fields', () => {
    const { metadata, workspace } = createMetadata()
    const initial = createInitialIssueDraft(metadata)
    const assignee = metadata.projects[0]?.assignees[0]
    const label = metadata.labels[0]

    if (!assignee || !label) throw new Error('Expected editor metadata.')

    const result = validateIssueCreateDraft(
      {
        ...initial,
        title: '  Coordinate launch review  ',
        description: '  Confirm every owner.  ',
        assigneeId: assignee.id,
        dueDate: '2026-03-04',
        labelIds: [label.id],
      },
      metadata,
      workspace.id,
    )

    expect(result.errors).toEqual({})
    expect(result.input).toMatchObject({
      title: 'Coordinate launch review',
      description: 'Confirm every owner.',
      dueDate: '2026-03-04',
      labelIds: [label.id],
    })
  })

  it('rejects missing workflow selections and invalid references', () => {
    const { metadata, workspace } = createMetadata()
    const initial = createInitialIssueDraft(metadata)
    const label = metadata.labels[0]

    if (!label) throw new Error('Expected label metadata.')

    const result = validateIssueCreateDraft(
      {
        ...initial,
        projectId: null,
        statusId: null,
        title: '',
        dueDate: '2026-02-30',
        labelIds: [label.id, label.id],
      },
      metadata,
      workspace.id,
    )

    expect(result.input).toBeNull()
    expect(result.errors).toMatchObject({
      projectId: 'Choose a project where you can create issues.',
      statusId: 'Choose a status from the project workflow.',
      title: 'Enter an issue title.',
      dueDate: 'Enter a valid calendar date.',
      labelIds: 'Choose valid workspace labels.',
    })
  })
})
