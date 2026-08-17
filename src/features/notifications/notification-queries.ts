import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { MarkNotificationReadInput, NotificationInbox } from '../../data'
import { atlasQueryKeys } from '../query-keys'

export function useNotificationInbox() {
  const { gateway, workspaceId } = useAppServices()
  return useQuery({
    queryKey: atlasQueryKeys.notifications(workspaceId),
    queryFn: ({ signal }) => gateway.listNotifications(workspaceId, { signal }),
  })
}

export function useMarkNotificationRead() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notifications(workspaceId)

  return useMutation<unknown, Error, MarkNotificationReadInput, NotificationInbox | undefined>(
    {
      mutationFn: (input) => gateway.markNotificationRead(input),
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey })
        const previous = queryClient.getQueryData<NotificationInbox>(queryKey)
        queryClient.setQueryData<NotificationInbox>(queryKey, (current) =>
          current
            ? {
                items: current.items.map((notification) =>
                  notification.id === input.id
                    ? {
                        ...notification,
                        readAt: input.read
                          ? (notification.readAt ?? notification.occurredAt)
                          : null,
                      }
                    : notification,
                ),
                unreadCount:
                  current.items.filter((notification) =>
                    notification.id === input.id
                      ? !input.read
                      : notification.readAt === null,
                  ).length,
              }
            : current,
        )
        return previous
      },
      onError: (_error, _input, previous) => {
        if (previous) queryClient.setQueryData(queryKey, previous)
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey })
      },
    },
  )
}

export function useMarkAllNotificationsRead() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notifications(workspaceId)

  return useMutation<number, Error, undefined, NotificationInbox | undefined>({
    mutationFn: () => gateway.markAllNotificationsRead(workspaceId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NotificationInbox>(queryKey)
      queryClient.setQueryData<NotificationInbox>(queryKey, (current) =>
        current
          ? {
              items: current.items.map((notification) => ({
                ...notification,
                readAt: notification.readAt ?? notification.occurredAt,
              })),
              unreadCount: 0,
            }
          : current,
      )
      return previous
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(queryKey, previous)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })
}
