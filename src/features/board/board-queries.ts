import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { Page } from '../../data'
import type { Issue, ProjectId, WorkflowStatusId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'
import {
  cancelIssueDerivedReads,
  reconcileIssueCaches,
  rollbackIssueCaches,
} from '../issues/issue-cache'

export function useBoardMetadata() {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.boardMetadata(workspaceId),
    queryFn: ({ signal }) => gateway.getBoardMetadata(workspaceId, { signal }),
  })
}

export function useBoardIssues(projectId: ProjectId | null) {
  const { gateway, workspaceId } = useAppServices()

  return useInfiniteQuery({
    queryKey:
      projectId === null
        ? [...atlasQueryKeys.workspaceIssues(workspaceId), 'board', 'unselected']
        : atlasQueryKeys.boardIssues(workspaceId, projectId),
    queryFn: ({ pageParam, signal }) => {
      if (projectId === null) {
        throw new TypeError('A project must be selected before loading its board.')
      }

      return gateway.listIssues(
        {
          filters: { workspaceId, projectIds: [projectId] },
          sort: { field: 'number', direction: 'ascending' },
          page: { number: pageParam, size: 50 },
        },
        { signal },
      )
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pageNumber < lastPage.pageCount
        ? lastPage.pageNumber + 1
        : undefined,
    enabled: projectId !== null,
  })
}

interface MoveIssueVariables {
  readonly issue: Issue
  readonly statusId: WorkflowStatusId
}

interface MoveIssueContext {
  readonly previousIssue: Issue
  readonly optimisticRevision: number
}

export function useMoveBoardIssue(projectId: ProjectId | null) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey =
    projectId === null
      ? [...atlasQueryKeys.workspaceIssues(workspaceId), 'board', 'unselected']
      : atlasQueryKeys.boardIssues(workspaceId, projectId)

  return useMutation<Issue, Error, MoveIssueVariables, MoveIssueContext>({
    scope: { id: `board:${projectId ?? 'unselected'}` },
    mutationFn: ({ issue, statusId }) =>
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes: { statusId },
      }),
    onMutate: async ({ issue, statusId }) => {
      await cancelIssueDerivedReads(queryClient, workspaceId)
      const previous = queryClient.getQueryData<InfiniteData<Page<Issue>, number>>(
        queryKey,
      )
      const previousIssue =
        previous?.pages
          .flatMap(({ items }) => items)
          .find(({ id }) => id === issue.id) ?? issue
      const optimisticRevision = previousIssue.revision + 1
      queryClient.setQueryData<InfiniteData<Page<Issue>, number>>(queryKey, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((candidate) =>
                  candidate.id === issue.id
                    ? {
                        ...candidate,
                        statusId,
                        revision: optimisticRevision,
                      }
                    : candidate,
                ),
              })),
            }
          : current,
      )
      return { previousIssue, optimisticRevision }
    },
    onError: (_error, _variables, context) => {
      if (context) {
        rollbackIssueCaches(
          queryClient,
          workspaceId,
          context.previousIssue,
          context.optimisticRevision,
        )
      }
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<InfiniteData<Page<Issue>, number>>(queryKey, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((candidate) =>
                  candidate.id === updated.id ? updated : candidate,
                ),
              })),
            }
          : current,
      )
      reconcileIssueCaches(queryClient, workspaceId, updated)
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
