import { describe, expect, it } from 'vitest'

import {
  issueWorkspaceDefaults,
  parseIssueWorkspaceState,
  serializeIssueWorkspaceState,
} from './issue-workspace-state'
import { projectId } from '../../domain'

describe('issue workspace URL state', () => {
  it('parses supported filters and rejects malformed values', () => {
    expect(
      parseIssueWorkspaceState(
        new URLSearchParams(
          'q=%20incident%20&project=prj_reliability&priority=urgent&sort=title&direction=ascending&page=2',
        ),
      ),
    ).toEqual({
      search: 'incident',
      projectId: projectId('prj_reliability'),
      priority: 'urgent',
      sortField: 'title',
      sortDirection: 'ascending',
      page: 2,
    })

    expect(
      parseIssueWorkspaceState(
        new URLSearchParams('project=wrong&priority=critical&sort=nope&page=-1'),
      ),
    ).toEqual(issueWorkspaceDefaults)
  })

  it('serializes defaults minimally and preserves explicit state', () => {
    expect(serializeIssueWorkspaceState(issueWorkspaceDefaults).toString()).toBe('')
    expect(
      serializeIssueWorkspaceState({
        ...issueWorkspaceDefaults,
        search: 'risk review',
        priority: 'high',
        page: 3,
      }).toString(),
    ).toBe('q=risk+review&priority=high&page=3')
  })
})
