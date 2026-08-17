import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { atlasQueryKeys } from '../../app/query/keys'
import { useAppServices } from '../../app/providers/app-services-context'
import type { ProjectSubscriptionData, SetProjectSubscriptionInput } from '../../data'
import type { ProjectId } from '../../domain'

interface SubscriptionMutationContext {
  readonly previous: ProjectSubscriptionData | undefined
  readonly optimisticSubscribed: boolean
}

export function useProjectSubscriptionData(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()

  return useQuery({
    queryKey: atlasQueryKeys.projectSubscription(workspaceId, projectId),
    queryFn: ({ signal }) => gateway.getProjectSubscription(projectId, { signal }),
  })
}

export function useSetProjectSubscription(projectId: ProjectId) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.projectSubscription(workspaceId, projectId)

  return useMutation<
    ProjectSubscriptionData,
    Error,
    SetProjectSubscriptionInput,
    SubscriptionMutationContext
  >({
    scope: { id: `project-subscription:${projectId}` },
    mutationFn: (input) => gateway.setProjectSubscription(input),
    onMutate: async ({ subscribed }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<ProjectSubscriptionData>(queryKey)
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
        queryClient.setQueryData<ProjectSubscriptionData>(queryKey, {
          ...previous,
          subscribers,
          subscribed,
        })
      }
      return { previous, optimisticSubscribed: subscribed }
    },
    onError: (_error, _variables, context) => {
      if (!context?.previous) return
      queryClient.setQueryData<ProjectSubscriptionData>(queryKey, (current) =>
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
          queryKey: atlasQueryKeys.projectActivity(workspaceId, projectId),
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
