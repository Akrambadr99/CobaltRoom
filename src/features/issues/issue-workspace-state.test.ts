import { describe, expect, it } from 'vitest'

import {
  issueWorkspaceDefaults,
  parseIssueWorkspaceState,
  reconcileIssueWorkspaceState,
  serializeIssueWorkspaceState,
} from './issue-workspace-state'
import { projectId, workflowStatusId } from '../../domain'

describe('issue workspace URL state', () => {
  it('parses supported filters and rejects malformed values', () => {
    expect(
      parseIssueWorkspaceState(
        new URLSearchParams(
          'q=%20incident%20&project=prj_reliability&status=status_in_progress&priority=urgent&sort=title&direction=ascending&page=2',
        ),
      ),
    ).toEqual({
      search: 'incident',
      projectId: projectId('prj_reliability'),
      statusId: workflowStatusId('status_in_progress'),
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
        statusId: workflowStatusId('status_backlog'),
        page: 3,
      }).toString(),
    ).toBe('q=risk+review&status=status_backlog&priority=high&page=3')
  })

  it('removes unavailable project and workflow references without changing valid state', () => {
    const launch = projectId('prj_launch')
    const active = workflowStatusId('status_launch_active')
    const filters = [{ id: launch, statusIds: [active] }]
    const valid = { ...issueWorkspaceDefaults, projectId: launch, statusId: active }

    expect(reconcileIssueWorkspaceState(valid, filters)).toBe(valid)
    expect(reconcileIssueWorkspaceState(
      { ...valid, statusId: workflowStatusId('status_retired'), page: 4 },
      filters,
    )).toEqual({ ...valid, statusId: null, page: 1 })
    expect(reconcileIssueWorkspaceState(
      { ...valid, projectId: projectId('prj_removed'), page: 3 },
      filters,
    )).toEqual({ ...valid, projectId: null, statusId: null, page: 1 })
  })
})
