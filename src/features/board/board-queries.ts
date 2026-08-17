import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { Page } from '../../data'
import type { Issue, ProjectId, WorkflowStatusId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useBoardMetadata() {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.boardMetadata(workspaceId),
    queryFn: ({ signal }) => gateway.getBoardMetadata(workspaceId, { signal }),
  })
}

export function useBoardIssues(projectId: ProjectId | null) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey:
      projectId === null
        ? [...atlasQueryKeys.workspaceIssues(workspaceId), 'board', 'unselected']
        : atlasQueryKeys.boardIssues(workspaceId, projectId),
    queryFn: ({ signal }) => {
      if (projectId === null) {
        throw new TypeError('A project must be selected before loading its board.')
      }

      return gateway.listIssues(
        {
          filters: { workspaceId, projectIds: [projectId] },
          sort: { field: 'number', direction: 'ascending' },
          page: { number: 1, size: 100 },
        },
        { signal },
      )
    },
    enabled: projectId !== null,
  })
}

interface MoveIssueVariables {
  readonly issue: Issue
  readonly statusId: WorkflowStatusId
}

interface MoveIssueContext {
  readonly previous: Page<Issue> | undefined
}

export function useMoveBoardIssue(projectId: ProjectId | null) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey =
    projectId === null
      ? [...atlasQueryKeys.workspaceIssues(workspaceId), 'board', 'unselected']
      : atlasQueryKeys.boardIssues(workspaceId, projectId)

  return useMutation<Issue, Error, MoveIssueVariables, MoveIssueContext>({
    mutationFn: ({ issue, statusId }) =>
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { statusId },
      }),
    onMutate: async ({ issue, statusId }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Page<Issue>>(queryKey)
      queryClient.setQueryData<Page<Issue>>(queryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((candidate) =>
                candidate.id === issue.id
                  ? {
                      ...candidate,
                      statusId,
                      revision: candidate.revision + 1,
                    }
                  : candidate,
              ),
            }
          : current,
      )
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Page<Issue>>(queryKey, (current) =>
        current
          ? {
              ...current,
              items: current.items.map((candidate) =>
                candidate.id === updated.id ? updated : candidate,
              ),
            }
          : current,
      )
      queryClient.setQueryData(
        atlasQueryKeys.issue(workspaceId, updated.id),
        updated,
      )
    },
    onSettled: async (_data, _error, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueActivity(workspaceId, variables.issue.id),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.notificationInbox(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.analytics(workspaceId),
        }),
      ])
    },
  })
}
