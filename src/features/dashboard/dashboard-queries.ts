import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { Page } from '../../data'
import type { Issue, IssuePriority } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useDashboardData() {
  const { gateway, workspaceId } = useAppServices()
  const projects = useQuery({
    queryKey: atlasQueryKeys.projects(workspaceId),
    queryFn: ({ signal }) => gateway.listProjects(workspaceId, { signal }),
  })
  const issues = useQuery({
    queryKey: atlasQueryKeys.dashboardIssues(workspaceId),
    queryFn: ({ signal }) =>
      gateway.listIssues(
        {
          filters: { workspaceId },
          sort: { field: 'priority', direction: 'ascending' },
          page: { number: 1, size: 5 },
        },
        { signal },
      ),
  })

  return { issues, projects }
}

export function useUpdateIssuePriority() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ issue, priority }: { issue: Issue; priority: IssuePriority }) =>
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { priority },
      }),
    onSuccess: async (updatedIssue) => {
      queryClient.setQueryData<Page<Issue>>(
        atlasQueryKeys.dashboardIssues(workspaceId),
        (current) =>
          current
            ? {
                ...current,
                items: current.items.map((issue) =>
                  issue.id === updatedIssue.id ? updatedIssue : issue,
                ),
              }
            : current,
      )

      await queryClient.invalidateQueries({
        queryKey: atlasQueryKeys.dashboardIssues(workspaceId),
      })
    },
  })
}
