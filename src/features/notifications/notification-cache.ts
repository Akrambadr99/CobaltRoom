import type {
  InfiniteData,
  QueryClient,
  QueryKey,
} from '@tanstack/react-query'

import type { NotificationInbox } from '../../data'
import {
  notificationCategory,
  type Notification,
  type NotificationCategory,
  type NotificationId,
} from '../../domain'

export type NotificationInboxData = InfiniteData<NotificationInbox, number>

interface NotificationInboxFilter {
  readonly category?: NotificationCategory
  readonly read?: boolean
}

export function findCachedNotification(
  queryClient: QueryClient,
  inboxKey: QueryKey,
  id: NotificationId,
): Notification | undefined {
  for (const [, data] of queryClient.getQueriesData<NotificationInboxData>({
    queryKey: inboxKey,
  })) {
    const notification = data?.pages
      .flatMap(({ items }) => items)
      .find((candidate) => candidate.id === id)
    if (notification) return notification
  }
  return undefined
}

export function transitionNotificationReadState(
  queryClient: QueryClient,
  inboxKey: QueryKey,
  notification: Notification,
  previousRead: boolean,
  read: boolean,
): void {
  if (previousRead === read) return

  for (const [queryKey, data] of queryClient.getQueriesData<NotificationInboxData>({
    queryKey: inboxKey,
  })) {
    if (!data) continue
    queryClient.setQueryData<NotificationInboxData>(
      queryKey,
      updateInbox(data, queryKey, notification, previousRead, read),
    )
  }
}

function updateInbox(
  data: NotificationInboxData,
  queryKey: QueryKey,
  notification: Notification,
  previousRead: boolean,
  read: boolean,
): NotificationInboxData {
  const firstPage = data.pages[0]
  if (!firstPage) return data

  const filter = readInboxFilter(queryKey)
  const categoryMatches =
    filter.category === undefined ||
    notificationCategory(notification.kind) === filter.category
  const previouslyMatched =
    categoryMatches &&
    (filter.read === undefined || filter.read === previousRead)
  const matches =
    categoryMatches && (filter.read === undefined || filter.read === read)
  const previousUnreadContribution = Number(previouslyMatched && !previousRead)
  const unreadContribution = Number(matches && !read)
  const totalItems = Math.max(
    0,
    firstPage.totalItems + Number(matches) - Number(previouslyMatched),
  )
  const unreadCount = Math.max(
    0,
    firstPage.unreadCount + Number(!read) - Number(!previousRead),
  )
  const readCount = Math.max(
    0,
    firstPage.readCount + Number(read) - Number(previousRead),
  )
  const matchingUnreadCount = Math.max(
    0,
    firstPage.matchingUnreadCount +
      unreadContribution -
      previousUnreadContribution,
  )
  const updatedNotification: Notification = {
    ...notification,
    readAt: read ? (notification.readAt ?? notification.occurredAt) : null,
  }
  const loadedItems = data.pages.flatMap(({ items }) => items)
  const wasLoaded = loadedItems.some(({ id }) => id === notification.id)
  let nextItems = loadedItems.filter(({ id }) => id !== notification.id)

  if (matches && (wasLoaded || !previouslyMatched)) {
    nextItems = [...nextItems, updatedNotification].sort(compareNotifications)
    const allPagesLoaded = data.pages.length >= firstPage.pageCount
    if (!allPagesLoaded) {
      const loadedCapacity = data.pages.reduce(
        (capacity, page) => capacity + page.pageSize,
        0,
      )
      nextItems = nextItems.slice(0, loadedCapacity)
    }
  }

  return {
    ...data,
    pages: data.pages.map((page, index) => ({
      ...page,
      items: nextItems.slice(index * page.pageSize, (index + 1) * page.pageSize),
      pageCount: Math.ceil(totalItems / page.pageSize),
      totalItems,
      unreadCount,
      readCount,
      matchingUnreadCount,
    })),
  }
}

function readInboxFilter(queryKey: QueryKey): NotificationInboxFilter {
  const candidate = queryKey.at(-1)
  if (typeof candidate !== 'object' || candidate === null) return {}

  return {
    ...('category' in candidate &&
    typeof candidate.category === 'string'
      ? { category: candidate.category as NotificationCategory }
      : {}),
    ...('read' in candidate && typeof candidate.read === 'boolean'
      ? { read: candidate.read }
      : {}),
  }
}

function compareNotifications(left: Notification, right: Notification): number {
  return (
    right.occurredAt.localeCompare(left.occurredAt) ||
    right.id.localeCompare(left.id)
  )
}
