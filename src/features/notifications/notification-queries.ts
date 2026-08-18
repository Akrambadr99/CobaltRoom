import {
  useInfiniteQuery,
  useMutationState,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import { useRef } from 'react'

import { useAppServices } from '../../app/providers/app-services-context'
import type {
  MarkNotificationReadInput,
  UpdateNotificationsReadStateInput,
} from '../../data'
import type { NotificationCategory, NotificationId } from '../../domain'
import { atlasQueryKeys } from '../../app/query/keys'
import {
  findCachedNotification,
  transitionNotificationReadState,
} from './notification-cache'

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

const notificationReadMutationKey = (workspaceId: string) =>
  ['notification-read-state', workspaceId] as const

export function useMarkNotificationRead(
  options: Readonly<{ onError?(): void }> = {},
) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const inboxKey = atlasQueryKeys.notificationInbox(workspaceId)
  const mutationKey = notificationReadMutationKey(workspaceId)
  const sequence = useRef(0)
  const latestMutation = useRef(new Map<NotificationId, number>())

  return useMutation<
    unknown,
    Error,
    MarkNotificationReadInput,
    | {
        readonly notification?: NonNullable<ReturnType<typeof findCachedNotification>>
        readonly previousRead?: boolean
        readonly sequence: number
      }
    | undefined
  >(
    {
      mutationKey,
      mutationFn: (input) => gateway.markNotificationRead(input),
      onMutate: async (input) => {
        const currentSequence = sequence.current + 1
        sequence.current = currentSequence
        latestMutation.current.set(input.id, currentSequence)
        await queryClient.cancelQueries({ queryKey: inboxKey })
        const notification = findCachedNotification(queryClient, inboxKey, input.id)
        if (!notification) return { sequence: currentSequence }
        const previousRead = notification.readAt !== null

        if (latestMutation.current.get(input.id) === currentSequence) {
          transitionNotificationReadState(
            queryClient,
            inboxKey,
            notification,
            previousRead,
            input.read,
          )
        }
        return { notification, previousRead, sequence: currentSequence }
      },
      onError: (_error, input, context) => {
        if (
          context?.notification &&
          context.previousRead !== undefined &&
          latestMutation.current.get(input.id) === context.sequence
        ) {
          transitionNotificationReadState(
            queryClient,
            inboxKey,
            context.notification,
            input.read,
            context.previousRead,
          )
        }
        options.onError?.()
      },
      onSettled: async (_data, _error, input, context) => {
        if (
          context &&
          latestMutation.current.get(input.id) === context.sequence
        ) {
          latestMutation.current.delete(input.id)
        }
        if (queryClient.isMutating({ mutationKey }) === 1) {
          await queryClient.invalidateQueries({ queryKey: inboxKey })
        }
      },
    },
  )
}

export function usePendingNotificationReadIds(): readonly NotificationId[] {
  const { workspaceId } = useAppServices()
  const pendingIds = useMutationState<NotificationId | undefined>({
    filters: {
      mutationKey: notificationReadMutationKey(workspaceId),
      status: 'pending',
    },
    select: (mutation) =>
      (mutation.state.variables as MarkNotificationReadInput | undefined)?.id,
  })
  return pendingIds.filter((id): id is NotificationId => id !== undefined)
}

export function useUpdateNotificationsReadState(
  options: Readonly<{ onError?(): void }> = {},
) {
  const { gateway, workspaceId } = useAppServices()
  const queryClient = useQueryClient()
  const inboxKey = atlasQueryKeys.notificationInbox(workspaceId)
  const mutationKey = notificationReadMutationKey(workspaceId)

  return useMutation<number, Error, Omit<UpdateNotificationsReadStateInput, 'workspaceId'>>({
    mutationKey,
    mutationFn: (input) =>
      gateway.updateNotificationsReadState({ ...input, workspaceId }),
    onError: () => {
      options.onError?.()
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey }) === 1) {
        await queryClient.invalidateQueries({ queryKey: inboxKey })
      }
    },
  })
}
