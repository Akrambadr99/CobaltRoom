import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type { MarkNotificationReadInput, NotificationInbox } from '../../data'
import type { NotificationCategory } from '../../domain'
import { atlasQueryKeys } from '../query-keys'

export function useNotificationInbox(category?: NotificationCategory) {
  const { gateway, workspaceId } = useAppServices()
  return useInfiniteQuery({
    queryKey: atlasQueryKeys.notificationInbox(workspaceId, category),
    queryFn: ({ pageParam, signal }) =>
      gateway.listNotifications(
        {
          workspaceId,
          ...(category ? { category } : {}),
          page: { number: pageParam, size: 20 },
        },
        { signal },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.pageNumber < lastPage.pageCount
        ? lastPage.pageNumber + 1
        : undefined,
  })
}

type NotificationInboxData = InfiniteData<NotificationInbox, number>

export function useMarkNotificationRead(category?: NotificationCategory) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notificationInbox(workspaceId, category)
  const inboxKey = atlasQueryKeys.notificationInbox(workspaceId)

  return useMutation<unknown, Error, MarkNotificationReadInput, NotificationInboxData | undefined>(
    {
      mutationFn: (input) => gateway.markNotificationRead(input),
      onMutate: async (input) => {
        await queryClient.cancelQueries({ queryKey })
        const previous = queryClient.getQueryData<NotificationInboxData>(queryKey)
        queryClient.setQueryData<NotificationInboxData>(queryKey, (current) => {
          if (!current) return current
          const target = current.pages
            .flatMap(({ items }) => items)
            .find(({ id }) => id === input.id)
          const unreadDelta = target
            ? Number(!input.read) - Number(target.readAt === null)
            : 0

          return {
            ...current,
            pages: current.pages.map((page) => ({
              ...page,
              unreadCount: Math.max(0, page.unreadCount + unreadDelta),
              items: page.items.map((notification) =>
                notification.id === input.id
                  ? {
                      ...notification,
                      readAt: input.read
                        ? (notification.readAt ?? notification.occurredAt)
                        : null,
                    }
                  : notification,
              ),
            })),
          }
        })
        return previous
      },
      onError: (_error, _input, previous) => {
        if (previous) queryClient.setQueryData(queryKey, previous)
      },
      onSettled: async () => {
        await queryClient.invalidateQueries({ queryKey: inboxKey })
      },
    },
  )
}

export function useMarkAllNotificationsRead(category?: NotificationCategory) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notificationInbox(workspaceId, category)
  const inboxKey = atlasQueryKeys.notificationInbox(workspaceId)

  return useMutation<number, Error, undefined, NotificationInboxData | undefined>({
    mutationFn: () => gateway.markAllNotificationsRead(workspaceId),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<NotificationInboxData>(queryKey)
      queryClient.setQueryData<NotificationInboxData>(queryKey, (current) =>
        current
          ? {
              ...current,
              pages: current.pages.map((page) => ({
                ...page,
                items: page.items.map((notification) => ({
                  ...notification,
                  readAt: notification.readAt ?? notification.occurredAt,
                })),
                unreadCount: 0,
              })),
            }
          : current,
      )
      return previous
    },
    onError: (_error, _variables, previous) => {
      if (previous) queryClient.setQueryData(queryKey, previous)
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: inboxKey })
    },
  })
}
