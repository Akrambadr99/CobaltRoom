import { describe, expect, it } from 'vitest'

import { membershipId } from './ids'
import {
  assertIssueRelations,
  assertProjectKey,
  assertProjectWorkflow,
  assertUniqueMemberships,
  DomainInvariantError,
} from './invariants'
import {
  createTestIssue,
  createTestMembership,
  createTestProject,
  createTestRelation,
  createTestWorkflowStatus,
  testIds,
} from '../test/domain'

describe('domain invariants', () => {
  it.each(['OP', 'OPS', 'A1', 'PROJECT123'])('accepts a valid project key', (key) => {
    expect(() => {
      assertProjectKey(key)
    }).not.toThrow()
  })

  it.each(['O', 'ops', '1OPS', 'PROJECT-OPS', 'PROJECT1234'])(
    'rejects an invalid project key',
    (key) => {
      expect(() => {
        assertProjectKey(key)
      }).toThrow(
        expect.objectContaining({ code: 'invalid-project-key' }),
      )
    },
  )

  it('rejects duplicate workspace memberships for the same user', () => {
    const memberships = [
      createTestMembership(),
      createTestMembership({ id: membershipId('mem_akram_duplicate') }),
    ]

    expect(() => {
      assertUniqueMemberships(memberships)
    }).toThrow(
      expect.objectContaining({ code: 'duplicate-membership' }),
    )
  })

  it('accepts unique memberships across users', () => {
    const memberships = [
      createTestMembership(),
      createTestMembership({
        id: membershipId('mem_mina'),
        userId: testIds.secondUser,
      }),
    ]

    expect(() => {
      assertUniqueMemberships(memberships)
    }).not.toThrow()
  })

  it('accepts a contiguous project workflow', () => {
    const project = createTestProject()
    const statuses = [
      createTestWorkflowStatus(),
      createTestWorkflowStatus({
        id: testIds.secondStatus,
        name: 'In progress',
        category: 'started',
        order: 1,
      }),
    ]

    expect(() => {
      assertProjectWorkflow(project, statuses)
    }).not.toThrow()
  })

  it.each([
    { statuses: [] },
    { statuses: [createTestWorkflowStatus({ order: 2 })] },
    {
      statuses: [
        createTestWorkflowStatus(),
        createTestWorkflowStatus({
          id: testIds.secondStatus,
          name: 'backlog',
          order: 1,
        }),
      ],
    },
    {
      statuses: [
        createTestWorkflowStatus(),
        createTestWorkflowStatus({
          id: testIds.secondStatus,
          name: 'Started',
          order: 1,
          projectId: testIds.secondProject,
        }),
      ],
    },
  ])('rejects an invalid project workflow', ({ statuses }) => {
    expect(() => {
      assertProjectWorkflow(createTestProject(), statuses)
    }).toThrow(expect.objectContaining({ code: 'invalid-workflow' }))
  })

  it('accepts unique acyclic issue relations', () => {
    const issues = [
      createTestIssue(),
      createTestIssue({ id: testIds.secondIssue, number: 2 }),
      createTestIssue({ id: testIds.thirdIssue, number: 3 }),
    ]
    const relations = [
      createTestRelation(testIds.issue, testIds.secondIssue),
      createTestRelation(testIds.secondIssue, testIds.thirdIssue),
    ]

    expect(() => {
      assertIssueRelations(issues, relations)
    }).not.toThrow()
  })

  it('rejects cyclic blocking relations', () => {
    const issues = [
      createTestIssue(),
      createTestIssue({ id: testIds.secondIssue, number: 2 }),
      createTestIssue({ id: testIds.thirdIssue, number: 3 }),
    ]
    const relations = [
      createTestRelation(testIds.issue, testIds.secondIssue),
      createTestRelation(testIds.secondIssue, testIds.thirdIssue),
      createTestRelation(testIds.thirdIssue, testIds.issue),
    ]

    expect(() => {
      assertIssueRelations(issues, relations)
    }).toThrow(
      expect.objectContaining({ code: 'cyclic-issue-dependency' }),
    )
  })

  it.each([
    [
      [createTestIssue()],
      [createTestRelation(testIds.issue, testIds.issue)],
    ],
    [
      [
        createTestIssue(),
        createTestIssue({
          id: testIds.secondIssue,
          number: 2,
          projectId: testIds.secondProject,
        }),
      ],
      [createTestRelation(testIds.issue, testIds.secondIssue)],
    ],
    [
      [createTestIssue(), createTestIssue({ id: testIds.secondIssue, number: 2 })],
      [
        createTestRelation(testIds.issue, testIds.secondIssue),
        createTestRelation(testIds.issue, testIds.secondIssue, {
          id: createTestRelation(testIds.secondIssue, testIds.issue).id,
        }),
      ],
    ],
  ])('rejects malformed or duplicate issue relations', (issues, relations) => {
    expect(() => {
      assertIssueRelations(issues, relations)
    }).toThrow(
      expect.objectContaining({ code: 'invalid-issue-relation' }),
    )
  })

  it('exposes a stable invariant error type', () => {
    const error = new DomainInvariantError('invalid-project-key', 'Invalid project')

    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe('DomainInvariantError')
  })
})
