import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { IssueSubscriptionData, SetIssueSubscriptionInput } from '../../data'
import type { IssueId } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

interface SubscriptionMutationContext {
  readonly previous: IssueSubscriptionData | undefined
  readonly optimisticSubscribed: boolean
}

export function useIssueSubscriptionData(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.issueSubscription(workspaceId, issueId),
    queryFn: ({ signal }) => gateway.getIssueSubscription(issueId, { signal }),
  })
}

export function useSetIssueSubscription(issueId: IssueId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.issueSubscription(workspaceId, issueId)

  return useMutation<
    IssueSubscriptionData,
    Error,
    SetIssueSubscriptionInput,
    SubscriptionMutationContext
  >({
    scope: { id: `issue-subscription:${issueId}` },
    mutationFn: (input) => gateway.setIssueSubscription(input),
    onMutate: async ({ subscribed }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<IssueSubscriptionData>(queryKey)
      if (previous) {
        const subscribers = subscribed
          ? previous.subscribers.some(({ id }) => id === previous.viewer.id)
            ? previous.subscribers
            : [...previous.subscribers, previous.viewer].sort(
                (left, right) =>
                  left.displayName.localeCompare(right.displayName) ||
                  left.id.localeCompare(right.id),
              )
          : previous.subscribers.filter(({ id }) => id !== previous.viewer.id)
        queryClient.setQueryData<IssueSubscriptionData>(queryKey, {
          ...previous,
          subscribers,
          subscribed,
        })
      }
      return { previous, optimisticSubscribed: subscribed }
    },
    onError: (_error, _variables, context) => {
      if (!context?.previous) return
      queryClient.setQueryData<IssueSubscriptionData>(queryKey, (current) =>
        current?.subscribed === context.optimisticSubscribed
          ? context.previous
          : current,
      )
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated)
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.issueActivity(workspaceId, issueId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.workspaceActivityReports(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: atlasQueryKeys.governanceReports(workspaceId),
        }),
      ])
    },
  })
}
