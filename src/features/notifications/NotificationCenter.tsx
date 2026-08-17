import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  notificationCategory,
  type NotificationCategory,
  type NotificationTarget,
} from '../../domain'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationInbox,
} from './notification-queries'
import './notification-center.css'

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState<NotificationCategory | undefined>()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const summary = useNotificationInbox()
  const filteredInbox = useNotificationInbox(category)
  const inbox = category ? filteredInbox : summary
  const markRead = useMarkNotificationRead(category)
  const markAllRead = useMarkAllNotificationsRead(category)
  const items = useMemo(
    () => inbox.data?.pages.flatMap((page) => page.items) ?? [],
    [inbox.data],
  )
  const unreadCount = summary.data?.pages[0]?.unreadCount ?? 0
  const categoryFacets = summary.data?.pages[0]?.categories ?? []

  useEffect(() => {
    if (!open) return
    const closeOnOutsideInteraction = (event: PointerEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      triggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', closeOnOutsideInteraction)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="notification-center" ref={rootRef}>
      <button
        ref={triggerRef}
        className="notification-center__trigger"
        type="button"
        aria-controls={panelId}
        aria-expanded={open}
        aria-label={`Notifications, ${unreadCount.toString()} unread`}
        onClick={() => {
          setOpen((current) => !current)
          setStatus('')
        }}
      >
        <span aria-hidden="true">Notifications</span>
        {unreadCount > 0 ? (
          <span className="notification-center__count" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section
          className="notification-center__panel"
          id={panelId}
          aria-label="Notifications"
        >
          <header>
            <div>
              <p className="page-eyebrow">Inbox</p>
              <h2>Notifications</h2>
            </div>
            <button
              type="button"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => {
                setStatus('')
                markAllRead.mutate(undefined, {
                  onSuccess: (count) => {
                    setStatus(
                      count === 1
                        ? '1 notification marked as read.'
                        : `${count.toString()} notifications marked as read.`,
                    )
                  },
                })
              }}
            >
              Mark all read
            </button>
          </header>

          <label className="notification-center__filter">
            <span>Category</span>
            <select
              value={category ?? ''}
              onChange={(event) => {
                const value = event.currentTarget.value
                setCategory(isNotificationCategory(value) ? value : undefined)
              }}
            >
              <option value="">All notifications</option>
              {categoryFacets.map(({ value, count }) => (
                <option key={value} value={value}>
                  {formatCategory(value)} ({count})
                </option>
              ))}
            </select>
          </label>

          {inbox.isPending ? <p role="status">Loading notifications…</p> : null}
          {inbox.isError ? (
            <div className="notification-center__state" role="alert">
              <p>Notifications could not be loaded.</p>
              <button type="button" onClick={() => void inbox.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {inbox.isSuccess && items.length === 0 ? (
            <p className="notification-center__state">
              {category ? 'No notifications match this category.' : 'You’re all caught up.'}
            </p>
          ) : null}
          {inbox.isSuccess && items.length > 0 ? (
            <>
              <ol className="notification-center__list">
                {items.map((notification) => (
                  <li
                    key={notification.id}
                    data-unread={notification.readAt === null}
                  >
                    <Link
                      to={notificationTargetHref(notification.target)}
                      onClick={() => {
                        setOpen(false)
                        if (notification.readAt === null) {
                          markRead.mutate({ id: notification.id, read: true })
                        }
                      }}
                    >
                      <strong>{notification.title}</strong>
                      <span>{notification.body}</span>
                      <span className="notification-center__category">
                        {formatCategory(notificationCategory(notification.kind))}
                      </span>
                      <time dateTime={notification.occurredAt}>
                        {formatNotificationTime(notification.occurredAt)}
                      </time>
                    </Link>
                    <button
                      type="button"
                      disabled={markRead.isPending}
                      onClick={() => {
                        const read = notification.readAt === null
                        setStatus('')
                        markRead.mutate(
                          { id: notification.id, read },
                          {
                            onSuccess: () => {
                              setStatus(
                                read
                                  ? 'Notification marked as read.'
                                  : 'Notification marked as unread.',
                              )
                            },
                          },
                        )
                      }}
                    >
                      Mark as {notification.readAt === null ? 'read' : 'unread'}
                    </button>
                  </li>
                ))}
              </ol>
              {inbox.hasNextPage ? (
                <button
                  className="notification-center__load-more"
                  type="button"
                  disabled={inbox.isFetchingNextPage}
                  onClick={() => void inbox.fetchNextPage()}
                >
                  {inbox.isFetchingNextPage
                    ? 'Loading older notifications…'
                    : 'Load older notifications'}
                </button>
              ) : null}
            </>
          ) : null}
          {markRead.isError || markAllRead.isError ? (
            <p className="notification-center__state" role="alert">
              The notification update did not complete. Your inbox was restored.
            </p>
          ) : null}
          {status ? <p className="visually-hidden" role="status">{status}</p> : null}
        </section>
      ) : null}
    </div>
  )
}

const notificationCategories: readonly NotificationCategory[] = [
  'work',
  'collaboration',
  'administration',
  'governance',
]

function isNotificationCategory(value: string): value is NotificationCategory {
  return notificationCategories.some((candidate) => candidate === value)
}

function notificationTargetHref(target: NotificationTarget): string {
  if (target.kind === 'issue') return `/issues/${target.id}`
  if (target.kind === 'project') return `/projects/${target.id}`
  if (target.kind === 'workspace') return `/activity?entity=${target.id}`
  if (target.kind === 'administration') return '/administration'
  return `/governance?request=${encodeURIComponent(target.id)}`
}

function formatCategory(value: NotificationCategory): string {
  return value.replace(/^./, (character) => character.toUpperCase())
}

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
