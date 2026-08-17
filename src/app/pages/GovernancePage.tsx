import { type ChangeEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import type { AuditEvent } from '../../domain'
import { useGovernanceReport } from '../../features/governance/governance-queries'
import { useAppServices } from '../providers/app-services-context'
import './pages.css'

const outcomes = ['succeeded', 'rejected', 'failed'] as const satisfies readonly AuditEvent['outcome'][]

export function GovernancePage() {
  const { workspaceId } = useAppServices()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const outcome = parseOutcome(searchParams.get('outcome'))
  const actionValue = searchParams.get('action')
  const action = actionValue === null || actionValue === '' ? undefined : actionValue
  const report = useGovernanceReport({
    workspaceId,
    page: { number: page, size: 10 },
    ...(outcome ? { outcome } : {}),
    ...(action ? { action } : {}),
  })

  const setFilter = (key: 'action' | 'outcome', value: string): void => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(key, value)
      else next.delete(key)
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

  if (report.isPending) {
    return (
      <section className="page" aria-labelledby="governance-title" aria-busy="true">
        <GovernanceHeader />
        <div className="dashboard-state" role="status">Loading governance report…</div>
      </section>
    )
  }

  if (report.isError) {
    const forbidden = 'code' in report.error && report.error.code === 'forbidden'
    return (
      <section className="page" aria-labelledby="governance-title">
        <GovernanceHeader />
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>{forbidden ? 'Governance access is restricted' : 'Governance report unavailable'}</h2>
          <p>
            {forbidden
              ? 'Only workspace owners and administrators can review authoritative audit data.'
              : 'The audit request did not complete.'}
          </p>
          {!forbidden ? (
            <button className="secondary-button" type="button" onClick={() => void report.refetch()}>
              Retry governance report
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="page" aria-labelledby="governance-title">
      <GovernanceHeader />
      <p className="analytics-generated">
        Authoritative snapshot generated{' '}
        <time dateTime={report.data.generatedAt}>{formatTimestamp(report.data.generatedAt)}</time>
      </p>

      <dl className="metric-grid" aria-label="Audit outcomes">
        <Metric label="All events" value={report.data.totalEvents} />
        <Metric label="Succeeded" value={report.data.succeededEvents} />
        <Metric label="Rejected or failed" value={report.data.rejectedEvents + report.data.failedEvents} />
      </dl>

      <form className="governance-filters" aria-label="Audit log filters">
        <label>
          <span>Outcome</span>
          <select
            value={outcome ?? ''}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setFilter('outcome', event.currentTarget.value)
            }}
          >
            <option value="">All outcomes</option>
            {outcomes.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
          </select>
        </label>
        <label>
          <span>Action</span>
          <select
            value={action ?? ''}
            onChange={(event: ChangeEvent<HTMLSelectElement>) => {
              setFilter('action', event.currentTarget.value)
            }}
          >
            <option value="">All actions</option>
            {report.data.actions.map(({ value, count }) => (
              <option key={value} value={value}>{value} ({count})</option>
            ))}
          </select>
        </label>
      </form>

      <section className="work-panel" aria-labelledby="audit-log-title">
        <div className="work-panel__header">
          <div>
            <p className="page-eyebrow">Protected operations record</p>
            <h2 id="audit-log-title">Audit log</h2>
          </div>
          <span>{report.data.events.totalItems} matching events</span>
        </div>
        {report.data.events.items.length === 0 ? (
          <div className="empty-panel"><p>No audit events match these filters.</p></div>
        ) : (
          <div className="analytics-table-scroll">
            <table className="analytics-table governance-table">
              <caption className="visually-hidden">Authoritative workspace audit events</caption>
              <thead><tr><th scope="col">Time</th><th scope="col">Action</th><th scope="col">Actor</th><th scope="col">Outcome</th><th scope="col">Request</th></tr></thead>
              <tbody>
                {report.data.events.items.map(({ event, actorName }) => (
                  <tr key={event.id}>
                    <td><time dateTime={event.occurredAt}>{formatTimestamp(event.occurredAt)}</time></td>
                    <th scope="row">{event.action}</th>
                    <td>{actorName}</td>
                    <td><span className={`governance-outcome governance-outcome--${event.outcome}`}>{formatLabel(event.outcome)}</span></td>
                    <td><code>{event.requestId}</code></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="governance-pagination" aria-label="Audit log pages">
          <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => { setPage(page - 1) }}>Previous</button>
          <span>Page {page} of {Math.max(report.data.events.pageCount, 1)}</span>
          <button className="secondary-button" type="button" disabled={page >= report.data.events.pageCount} onClick={() => { setPage(page + 1) }}>Next</button>
        </nav>
      </section>
    </section>
  )
}

function GovernanceHeader() {
  return <header className="page-header"><p className="page-eyebrow">Workspace governance</p><h1 id="governance-title">Governance</h1><p>Review permission-protected operational evidence and request outcomes.</p></header>
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="metric-card"><dt>{label}</dt><dd>{value}</dd></div>
}

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1')
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function parseOutcome(value: string | null): AuditEvent['outcome'] | undefined {
  return outcomes.find((candidate) => candidate === value)
}

function formatLabel(value: string): string {
  return value.replaceAll('-', ' ').replace(/^./, (character) => character.toUpperCase())
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))
}
