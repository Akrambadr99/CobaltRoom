import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { UpdateNotificationPreferencesInput } from '../../data'
import type { NotificationPreferences } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'

export function useNotificationPreferences() {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.notificationPreferences(workspaceId),
    queryFn: ({ signal }) => gateway.getNotificationPreferences(workspaceId, { signal }),
  })
}

export function useUpdateNotificationPreferences() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notificationPreferences(workspaceId)

  return useMutation<
    NotificationPreferences,
    Error,
    UpdateNotificationPreferencesInput,
    NotificationPreferences | undefined
  >({
    mutationFn: (input) => gateway.updateNotificationPreferences(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NotificationPreferences>(queryKey)
      queryClient.setQueryData<NotificationPreferences>(queryKey, (current) =>
        current
          ? {
              ...current,
              assignments: input.assignments,
              comments: input.comments,
              issueUpdates: input.issueUpdates,
              projectUpdates: input.projectUpdates,
              revision: current.revision + 1,
            }
          : current,
      )
      return previous
    },
    onError: (_error, _input, previous) => {
      if (previous) queryClient.setQueryData(queryKey, previous)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKey, updated)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}
