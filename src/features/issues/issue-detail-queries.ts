import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { MutableIssueFields } from '../../data'
import type { Issue, IssueId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useIssueDetailData(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const issue = useQuery({
    queryKey: atlasQueryKeys.issue(workspaceId, issueId),
    queryFn: ({ signal }) => gateway.getIssue(issueId, { signal }),
  })
  const projects = useQuery({
    queryKey: atlasQueryKeys.projects(workspaceId),
    queryFn: ({ signal }) => gateway.listProjects(workspaceId, { signal }),
  })

  return { issue, projects }
}

export function useIssueActivityData(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
    queryFn: ({ signal }) => gateway.getIssueActivity(issueId, { signal }),
  })
}

export function useCreateIssueComment(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (body: string) => gateway.createComment({ issueId, body }),
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.notificationInbox(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
      ])
    },
  })
}

interface UpdateIssueVariables {
  readonly issue: Issue
  readonly changes: Partial<MutableIssueFields>
}

interface UpdateIssueContext {
  readonly previous: Issue | undefined
}

export function useOptimisticIssueUpdate(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const detailKey = atlasQueryKeys.issue(workspaceId, issueId)

  return useMutation<Issue, Error, UpdateIssueVariables, UpdateIssueContext>({
    mutationFn: ({ issue, changes }) =>
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes,
      }),
    onMutate: async ({ issue, changes }) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<Issue>(detailKey)
      queryClient.setQueryData<Issue>(detailKey, {
        ...(previous ?? issue),
        ...changes,
        revision: issue.revision + 1,
      })
      return { previous }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(detailKey, updated)
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: detailKey }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.workspaceIssues(workspaceId),
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
