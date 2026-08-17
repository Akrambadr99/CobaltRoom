import { useEffect, type ChangeEvent, type SyntheticEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import { workspaceActivityEntityKinds } from '../../data'
import { isoDateTime, userId, type EntityKind, type UserId } from '../../domain'
import { useWorkspaceActivity } from '../../features/activity/activity-queries'
import { hasAppErrorKind } from '../errors/classify-app-error'
import { useAppServices } from '../providers/app-services-context'
import './pages.css'

export function ActivityPage() {
  const { workspaceId } = useAppServices()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const actorId = parseActor(searchParams.get('actor'))
  const action = optionalParameter(searchParams.get('action'))
  const entityKind = parseEntityKind(searchParams.get('kind'))
  const entityId = optionalParameter(searchParams.get('entity'))
  const from = parseDate(searchParams.get('from'))
  const to = parseDate(searchParams.get('to'))
  const activity = useWorkspaceActivity({
    workspaceId,
    page: { number: page, size: 20 },
    ...(actorId ? { actorId } : {}),
    ...(action ? { action } : {}),
    ...(entityKind ? { entityKind } : {}),
    ...(entityId ? { entityId } : {}),
    ...(from ? { occurredFrom: dateBoundary(from, false) } : {}),
    ...(to ? { occurredTo: dateBoundary(to, true) } : {}),
  })

  useEffect(() => {
    if (!activity.data) return
    const lastPage = Math.max(activity.data.events.pageCount, 1)
    if (page <= lastPage) return
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (lastPage === 1) next.delete('page')
      else next.set('page', String(lastPage))
      return next
    })
  }, [activity.data, page, setSearchParams])

  const setFilter = (key: string, value: string): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('page')
      return next
    })
  }

  const submitFilters = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      for (const key of ['entity', 'from', 'to']) {
        const value = formValue(form, key)
        if (value) next.set(key, value)
        else next.delete(key)
      }
      next.delete('page')
      return next
    })
  }

  const setPage = (nextPage: number): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      return next
    })
  }

  if (activity.isPending) {
    return (
      <section className="page" aria-labelledby="activity-title" aria-busy="true">
        <ActivityHeader />
        <div className="dashboard-state" role="status">Loading workspace activity…</div>
      </section>
    )
  }

  if (activity.isError) {
    const forbidden = hasAppErrorKind(activity.error, 'forbidden')
    return (
      <section className="page" aria-labelledby="activity-title">
        <ActivityHeader />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>{forbidden ? 'Activity access is restricted' : 'Workspace activity unavailable'}</h2>
          <p>
            {forbidden
              ? 'Your current workspace session cannot view this activity.'
              : 'The activity request did not complete. Existing work remains available.'}
          </p>
          {!forbidden ? (
            <button className="secondary-button" type="button" onClick={() => void activity.refetch()}>
              Retry activity
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  const pageCount = Math.max(activity.data.events.pageCount, 1)

  return (
    <section className="page" aria-labelledby="activity-title">
      <ActivityHeader />
      <p className="analytics-generated">
        Feed refreshed{' '}
        <time dateTime={activity.data.generatedAt}>{formatTimestamp(activity.data.generatedAt)}</time>
      </p>
      <p className="visually-hidden" role="status" aria-live="polite">
        {activity.isFetching ? 'Refreshing workspace activity.' : ''}
      </p>

      <form
        className="governance-filters governance-filters--advanced"
        aria-label="Workspace activity filters"
        onSubmit={submitFilters}
      >
        <label>
          <span>Actor</span>
          <select value={actorId ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setFilter('actor', event.currentTarget.value) }}>
            <option value="">All actors</option>
            {activity.data.actors.map(({ value, label, count }) => (
              <option key={value} value={value}>{label} ({count})</option>
            ))}
          </select>
        </label>
        <label>
          <span>Action</span>
          <select value={action ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setFilter('action', event.currentTarget.value) }}>
            <option value="">All actions</option>
            {activity.data.actions.map(({ value, count }) => (
              <option key={value} value={value}>{value} ({count})</option>
            ))}
          </select>
        </label>
        <label>
          <span>Entity type</span>
          <select value={entityKind ?? ''} onChange={(event: ChangeEvent<HTMLSelectElement>) => { setFilter('kind', event.currentTarget.value) }}>
            <option value="">All entity types</option>
            {activity.data.entityKinds.map(({ value, count }) => (
              <option key={value} value={value}>{formatLabel(value)} ({count})</option>
            ))}
          </select>
        </label>
        <FilterInput label="Entity ID" name="entity" defaultValue={entityId ?? ''} />
        <FilterInput label="From date" name="from" type="date" defaultValue={from ?? ''} />
        <FilterInput label="To date" name="to" type="date" defaultValue={to ?? ''} />
        <div className="governance-filter-actions">
          <button className="secondary-button" type="submit">Apply filters</button>
          <button className="text-button" type="button" onClick={() => { setSearchParams({}) }}>
            Clear filters
          </button>
        </div>
      </form>

      <section className="work-panel" aria-labelledby="workspace-feed-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Product collaboration history</p>
            <h2 id="workspace-feed-title">Workspace feed</h2>
          </div>
          <span>{activity.data.events.totalItems} matching events</span>
        </div>
        {activity.data.events.items.length === 0 ? (
          <div className="empty-panel"><p>No activity matches these filters.</p></div>
        ) : (
          <ol className="activity-feed" aria-label="Workspace activity timeline">
            {activity.data.events.items.map(({ actor, event, target }) => {
              const headingId = `activity-${event.id}`
              return (
                <li key={event.id}>
                  <article aria-labelledby={headingId}>
                    <div className="activity-feed__marker" aria-hidden="true" />
                    <div className="activity-feed__content">
                      <div className="activity-feed__heading">
                        <h3 id={headingId}>{event.summary}</h3>
                        <time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt)}</time>
                      </div>
                      <p>
                        <Link to={{ search: filterDeepLink(searchParams, 'actor', actor.id) }}>{actor.displayName}</Link>
                        {' · '}
                        <Link to={{ search: filterDeepLink(searchParams, 'action', event.action) }}>{event.action}</Link>
                        {' · '}{formatLabel(event.entityKind)}
                      </p>
                      <div className="activity-feed__target">
                        {target.href ? <Link to={target.href}>{target.label}</Link> : <span>{target.label}</span>}
                        <Link
                          className="text-link"
                          aria-label={`Filter activity for ${target.label}`}
                          to={{ search: filterDeepLink(searchParams, 'entity', event.entityId) }}
                        >
                          Filter entity
                        </Link>
                      </div>
                    </div>
                  </article>
                </li>
              )
            })}
          </ol>
        )}
        <nav className="governance-pagination" aria-label="Workspace activity pages">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => { setPage(page - 1) }}>Previous</button>
          <span>Page {page} of {pageCount}</span>
          <button className="secondary-button" type="button" disabled={page >= activity.data.events.pageCount} onClick={() => { setPage(page + 1) }}>Next</button>
        </nav>
      </section>
    </section>
  )
}

function ActivityHeader() {
  return (
    <header className="page-header">
      <p className="page-eyebrow">Workspace collaboration</p>
      <h1 id="activity-title">Activity</h1>
      <p>Follow product changes and collaboration separately from protected operational audit evidence.</p>
    </header>
  )
}

function FilterInput({
  label,
  name,
  defaultValue,
  type = 'text',
}: Readonly<{ label: string; name: string; defaultValue: string; type?: string }>) {
  return (
    <label>
      <span>{label}</span>
      <input key={defaultValue} name={name} type={type} defaultValue={defaultValue} maxLength={type === 'text' ? 200 : undefined} />
    </label>
  )
}

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1')
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function parseActor(value: string | null): UserId | undefined {
  if (!value) return undefined
  try {
    return userId(value)
  } catch {
    return undefined
  }
}

function parseEntityKind(value: string | null): EntityKind | undefined {
  return workspaceActivityEntityKinds.find((candidate) => candidate === value)
}

function optionalParameter(value: string | null): string | undefined {
  return value === null || value === '' ? undefined : value.slice(0, 200)
}

function parseDate(value: string | null): string | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value
    ? value
    : undefined
}

function dateBoundary(value: string, end: boolean) {
  return isoDateTime(`${value}T${end ? '23:59:59.999' : '00:00:00.000'}Z`)
}

function formValue(form: FormData, key: string): string | null {
  const value = form.get(key)
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 200) : null
}

function filterDeepLink(current: URLSearchParams, key: string, value: string): string {
  const next = new URLSearchParams(current)
  next.set(key, value)
  next.delete('page')
  return `?${next.toString()}`
}

function formatLabel(value: string): string {
  return value.replaceAll('-', ' ').replace(/^./, (character) => character.toUpperCase())
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
}
