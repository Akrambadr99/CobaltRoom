import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  notificationCategory,
  type NotificationCategory,
  type NotificationId,
  type NotificationTarget,
} from '../../domain'
import {
  useMarkNotificationRead,
  useNotificationInbox,
  useUpdateNotificationsReadState,
} from './notification-queries'
import './notification-center.css'

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState<NotificationCategory | undefined>()
  const [readFilter, setReadFilter] = useState<NotificationReadFilter>('all')
  const [selectedIds, setSelectedIds] = useState<readonly NotificationId[]>([])
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const summary = useNotificationInbox()
  const read = readFilter === 'all' ? undefined : readFilter === 'read'
  const filteredInbox = useNotificationInbox(category, read)
  const inbox = category || read !== undefined ? filteredInbox : summary
  const markRead = useMarkNotificationRead(category, read)
  const updateReadState = useUpdateNotificationsReadState()
  const items = useMemo(
    () => inbox.data?.pages.flatMap((page) => page.items) ?? [],
    [inbox.data],
  )
  const unreadCount = summary.data?.pages[0]?.unreadCount ?? 0
  const categoryFacets = summary.data?.pages[0]?.categories ?? []
  const matchingUnreadCount = inbox.data?.pages[0]?.matchingUnreadCount ?? 0
  const selectedItems = items.filter(({ id }) => selectedIds.includes(id))
  const selectedUnreadCount = selectedItems.filter(({ readAt }) => readAt === null).length
  const selectedReadCount = selectedItems.length - selectedUnreadCount
  const allLoadedSelected = items.length > 0 && selectedItems.length === items.length

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
              disabled={matchingUnreadCount === 0 || updateReadState.isPending}
              onClick={() => {
                setStatus('')
                updateReadState.mutate({
                  read: true,
                  ...(category ? { category } : {}),
                  ...(read !== undefined ? { currentRead: read } : {}),
                }, {
                  onSuccess: (count) => {
                    setSelectedIds([])
                    setStatus(
                      count === 1
                        ? '1 notification marked as read.'
                        : `${count.toString()} notifications marked as read.`,
                    )
                  },
                })
              }}
            >
              Mark matching read
            </button>
          </header>

          <div className="notification-center__filters">
            <label className="notification-center__filter">
              <span>Category</span>
              <select
                value={category ?? ''}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  setCategory(isNotificationCategory(value) ? value : undefined)
                  setSelectedIds([])
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
            <label className="notification-center__filter">
              <span>Status</span>
              <select
                value={readFilter}
                onChange={(event) => {
                  setReadFilter(parseNotificationReadFilter(event.currentTarget.value))
                  setSelectedIds([])
                }}
              >
                <option value="all">All statuses</option>
                <option value="unread">
                  Unread ({unreadCount.toString()})
                </option>
                <option value="read">
                  Read ({(summary.data?.pages[0]?.readCount ?? 0).toString()})
                </option>
              </select>
            </label>
          </div>

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
              {category || read !== undefined
                ? 'No notifications match these filters.'
                : 'You’re all caught up.'}
            </p>
          ) : null}
          {inbox.isSuccess && items.length > 0 ? (
            <>
              <div className="notification-center__bulk">
                <label>
                  <input
                    type="checkbox"
                    checked={allLoadedSelected}
                    onChange={(event) => {
                      setSelectedIds(event.currentTarget.checked ? items.map(({ id }) => id) : [])
                    }}
                  />
                  Select all loaded
                </label>
                <span>{selectedItems.length.toString()} selected</span>
                <button
                  type="button"
                  disabled={selectedUnreadCount === 0 || updateReadState.isPending}
                  onClick={() => {
                    setStatus('')
                    updateReadState.mutate(
                      { ids: selectedIds, read: true },
                      {
                        onSuccess: (count) => {
                          setSelectedIds([])
                          setStatus(`${count.toString()} selected notifications marked as read.`)
                        },
                      },
                    )
                  }}
                >
                  Mark selected read
                </button>
                <button
                  type="button"
                  disabled={selectedReadCount === 0 || updateReadState.isPending}
                  onClick={() => {
                    setStatus('')
                    updateReadState.mutate(
                      { ids: selectedIds, read: false },
                      {
                        onSuccess: (count) => {
                          setSelectedIds([])
                          setStatus(`${count.toString()} selected notifications marked as unread.`)
                        },
                      },
                    )
                  }}
                >
                  Mark selected unread
                </button>
              </div>
              <ol className="notification-center__list">
                {items.map((notification) => (
                  <li
                    key={notification.id}
                    data-unread={notification.readAt === null}
                  >
                    <label className="notification-center__select">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(notification.id)}
                        onChange={(event) => {
                          const checked = event.currentTarget.checked
                          setSelectedIds((current) =>
                            checked
                              ? current.includes(notification.id)
                                ? current
                                : [...current, notification.id]
                              : current.filter((id) => id !== notification.id),
                          )
                        }}
                      />
                      <span className="visually-hidden">
                        Select {notification.title}
                      </span>
                    </label>
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
          {markRead.isError || updateReadState.isError ? (
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

type NotificationReadFilter = 'all' | 'unread' | 'read'

function parseNotificationReadFilter(value: string): NotificationReadFilter {
  if (value === 'read' || value === 'unread') return value
  return 'all'
}

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
