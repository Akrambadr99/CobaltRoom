import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationInbox,
} from './notification-queries'
import './notification-center.css'

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const inbox = useNotificationInbox()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const unreadCount = inbox.data?.unreadCount ?? 0

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

          {inbox.isPending ? <p role="status">Loading notifications…</p> : null}
          {inbox.isError ? (
            <div className="notification-center__state" role="alert">
              <p>Notifications could not be loaded.</p>
              <button type="button" onClick={() => void inbox.refetch()}>
                Retry
              </button>
            </div>
          ) : null}
          {inbox.isSuccess && inbox.data.items.length === 0 ? (
            <p className="notification-center__state">You’re all caught up.</p>
          ) : null}
          {inbox.isSuccess && inbox.data.items.length > 0 ? (
            <ol className="notification-center__list">
              {inbox.data.items.map((notification) => (
                <li
                  key={notification.id}
                  data-unread={notification.readAt === null || undefined}
                >
                  <Link
                    to={`/issues/${notification.issueId}`}
                    onClick={() => {
                      setOpen(false)
                      if (notification.readAt === null) {
                        markRead.mutate({ id: notification.id, read: true })
                      }
                    }}
                  >
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
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

function formatNotificationTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value))
}
