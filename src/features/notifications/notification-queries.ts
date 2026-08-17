import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  MarkNotificationReadInput,
  NotificationInbox,
  UpdateNotificationsReadStateInput,
} from '../../data'
import type { NotificationCategory } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'

export function useNotificationInbox(
  category?: NotificationCategory,
  read?: boolean,
) {
  const { gateway, workspaceId } = useAppServices()
  return useInfiniteQuery({
    queryKey: atlasQueryKeys.notificationInbox(workspaceId, category, read),
    queryFn: ({ pageParam, signal }) =>
      gateway.listNotifications(
        {
          workspaceId,
          ...(category ? { category } : {}),
          ...(read !== undefined ? { read } : {}),
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

export function useMarkNotificationRead(
  category?: NotificationCategory,
  read?: boolean,
) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const queryKey = atlasQueryKeys.notificationInbox(workspaceId, category, read)
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

export function useUpdateNotificationsReadState() {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const inboxKey = atlasQueryKeys.notificationInbox(workspaceId)

  return useMutation<number, Error, Omit<UpdateNotificationsReadStateInput, 'workspaceId'>>({
    mutationFn: (input) =>
      gateway.updateNotificationsReadState({ ...input, workspaceId }),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: inboxKey })
    },
  })
}
