import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { MutableIssueFields } from '../../data'
import type { Issue, IssueId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'
import {
  cancelIssueDerivedReads,
  reconcileIssueCaches,
  rollbackIssueCaches,
} from './issue-cache'

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
    scope: { id: `comment-create:${issueId}` },
    mutationFn: (body: string) => gateway.createComment({ issueId, body }),
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({
          queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
        }),
        queryClient.cancelQueries({
          queryKey: atlasQueryKeys.issueSubscription(workspaceId, issueId),
        }),
        queryClient.cancelQueries({
          queryKey: atlasQueryKeys.notificationInbox(workspaceId),
        }),
        queryClient.cancelQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
      ])
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueSubscription(workspaceId, issueId),
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
  readonly optimisticRevision: number
}

export function useOptimisticIssueUpdate(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const detailKey = atlasQueryKeys.issue(workspaceId, issueId)

  return useMutation<Issue, Error, UpdateIssueVariables, UpdateIssueContext>({
    scope: { id: `issue:${issueId}` },
    mutationFn: ({ issue, changes }) =>
      gateway.updateIssue({
        id: issue.id,
        expectedRevision: issue.revision,
        changes,
      }),
    onMutate: async ({ issue, changes }) => {
      await cancelIssueDerivedReads(queryClient, workspaceId)
      const previous = queryClient.getQueryData<Issue>(detailKey)
      const optimisticRevision = (previous ?? issue).revision + 1
      queryClient.setQueryData<Issue>(detailKey, {
        ...(previous ?? issue),
        ...changes,
        revision: optimisticRevision,
      })
      return { previous, optimisticRevision }
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        rollbackIssueCaches(
          queryClient,
          workspaceId,
          context.previous,
          context.optimisticRevision,
        )
      }
    },
    onSuccess: (updated) => {
      reconcileIssueCaches(queryClient, workspaceId, updated)
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
