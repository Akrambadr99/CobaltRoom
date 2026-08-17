import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import { atlasQueryKeys } from '../query-keys'
import { toIssueQuery, type IssueWorkspaceState } from './issue-workspace-state'

export function useIssueWorkspaceData(state: IssueWorkspaceState) {
  const { gateway, workspaceId } = useAppServices()
  const query = toIssueQuery(workspaceId, state)
  const projects = useQuery({
    queryKey: atlasQueryKeys.projects(workspaceId),
    queryFn: ({ signal }) => gateway.listProjects(workspaceId, { signal }),
  })
  const issues = useQuery({
    queryKey: atlasQueryKeys.issues(workspaceId, query),
    queryFn: ({ signal }) => gateway.listIssues(query, { signal }),
    placeholderData: keepPreviousData,
  })

  return { issues, projects }
}
