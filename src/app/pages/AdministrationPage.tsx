import { useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type { WorkspaceMemberEntry } from '../../data'
import type { MembershipStatus, WorkspaceRole } from '../../domain'
import {
  useUpdateWorkspaceMembership,
  useWorkspaceAdministration,
} from '../../features/administration/administration-queries'
import { WorkspaceInvitationPanel } from '../../features/administration/WorkspaceInvitationPanel'
import { hasAppErrorKind } from '../errors/classify-app-error'
import { useAppServices } from '../providers/app-services-context'
import './pages.css'

const roles: readonly WorkspaceRole[] = ['owner', 'admin', 'member', 'viewer']
const statuses: readonly MembershipStatus[] = ['invited', 'active', 'suspended']

export function AdministrationPage() {
  const { workspaceId } = useAppServices()
  const [parameters, setParameters] = useSearchParams()
  const page = parsePage(parameters.get('page'))
  const search = parameters.get('q')?.slice(0, 100) ?? ''
  const role = parseRole(parameters.get('role'))
  const status = parseStatus(parameters.get('status'))
  const [editing, setEditing] = useState<WorkspaceMemberEntry | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const query = {
    workspaceId,
    ...(search ? { search } : {}),
    ...(role ? { roles: [role] } : {}),
    ...(status ? { statuses: [status] } : {}),
    page: { number: page, size: 20 },
  }
  const administration = useWorkspaceAdministration(query)

  useEffect(() => {
    if (!administration.data) return
    const lastPage = Math.max(administration.data.members.pageCount, 1)
    if (page <= lastPage) return
    setParameters((current) => {
      const next = new URLSearchParams(current)
      if (lastPage === 1) next.delete('page')
      else next.set('page', String(lastPage))
      return next
    })
  }, [administration.data, page, setParameters])

  const updateParameters = (changes: Record<string, string | null>): void => {
    setParameters((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('page' in changes)) next.delete('page')
      return next
    })
  }

  const handleSearch = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('search')
    updateParameters({ q: typeof value === 'string' ? value.trim().slice(0, 100) : null })
  }

  return (
    <section className="page" aria-labelledby="administration-title">
      <header className="page-header">
        <p className="page-eyebrow">Workspace access</p>
        <h1 id="administration-title">Administration</h1>
        <p>Manage member roles and access with revision-protected changes.</p>
      </header>

      <form className="administration-filters" role="search" onSubmit={handleSearch}>
        <label>
          <span>Search members</span>
          <input key={search} name="search" type="search" defaultValue={search} maxLength={100} />
        </label>
        <label>
          <span>Role</span>
          <select
            value={role ?? ''}
            onChange={(event) => {
              updateParameters({ role: event.currentTarget.value || null })
            }}
          >
            <option value="">All roles</option>
            {roles.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
          </select>
        </label>
        <label>
          <span>Status</span>
          <select
            value={status ?? ''}
            onChange={(event) => {
              updateParameters({ status: event.currentTarget.value || null })
            }}
          >
            <option value="">All statuses</option>
            {statuses.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
          </select>
        </label>
        <button className="secondary-button" type="submit">Search</button>
      </form>

      {administration.isPending ? (
        <div className="dashboard-state" role="status">Loading workspace members…</div>
      ) : administration.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h2>Administration access is unavailable</h2>
          <p>
            {hasAppErrorKind(administration.error, 'forbidden')
              ? 'Your current role cannot manage workspace members.'
              : 'The authoritative membership request did not complete.'}
          </p>
          <button className="secondary-button" type="button" onClick={() => void administration.refetch()}>
            Retry members
          </button>
        </div>
      ) : (
        <section className="work-panel" aria-labelledby="members-title">
          <div className="work-panel__header">
            <div>
              <p className="page-eyebrow">Authoritative directory</p>
              <h2 id="members-title">Workspace members</h2>
            </div>
            <p>{administration.data.members.totalItems} matching members</p>
          </div>
          {administration.data.members.items.length === 0 ? (
            <p className="project-activity-empty">No members match these filters.</p>
          ) : (
            <div className="analytics-table-scroll">
              <table className="analytics-table administration-table">
                <caption className="visually-hidden">Workspace membership administration</caption>
                <thead>
                  <tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Revision</th><th scope="col">Actions</th></tr>
                </thead>
                <tbody>
                  {administration.data.members.items.map((entry) => (
                    <tr key={entry.membership.id}>
                      <th scope="row"><span>{entry.user.displayName}</span><small>{entry.user.email}</small></th>
                      <td>{formatLabel(entry.membership.role)}</td>
                      <td><span className={`membership-status membership-status--${entry.membership.status}`}>{formatLabel(entry.membership.status)}</span></td>
                      <td>{entry.membership.revision}</td>
                      <td>
                        {entry.canEdit ? (
                          <button className="secondary-button" type="button" onClick={() => { setAnnouncement(''); setEditing(entry) }}>
                            Edit {entry.user.displayName}
                          </button>
                        ) : <span className="administration-protected">Protected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav className="governance-pagination" aria-label="Member directory pages">
            <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => { updateParameters({ page: String(page - 1) }) }}>Previous</button>
            <span>Page {page} of {Math.max(administration.data.members.pageCount, 1)}</span>
            <button className="secondary-button" type="button" disabled={page >= administration.data.members.pageCount} onClick={() => { updateParameters({ page: String(page + 1) }) }}>Next</button>
          </nav>
        </section>
      )}
      {administration.isSuccess ? <WorkspaceInvitationPanel /> : null}
      {announcement ? <p className="visually-hidden" role="status">{announcement}</p> : null}
      {editing ? (
        <MembershipDialog
          entry={editing}
          onClose={() => { setEditing(null) }}
          onUpdated={(updatedRole, updatedStatus) => {
            setAnnouncement(`${editing.user.displayName} is now ${updatedRole} and ${updatedStatus}.`)
            setEditing(null)
          }}
        />
      ) : null}
    </section>
  )
}

function MembershipDialog({
  entry,
  onClose,
  onUpdated,
}: Readonly<{
  entry: WorkspaceMemberEntry
  onClose: () => void
  onUpdated: (role: WorkspaceRole, status: MembershipStatus) => void
}>) {
  const mutation = useUpdateWorkspaceMembership()
  const [role, setRole] = useState(entry.membership.role)
  const [status, setStatus] = useState(entry.membership.status)
  const [confirmSuspension, setConfirmSuspension] = useState(false)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const isSuspension =
    status === 'suspended' && entry.membership.status !== 'suspended'

  useEffect(() => {
    if (confirmSuspension) confirmButton.current?.focus()
  }, [confirmSuspension])

  const submitUpdate = (): void => {
    mutation.mutate(
      {
        id: entry.membership.id,
        expectedRevision: entry.membership.revision,
        role,
        status,
      },
      { onSuccess: () => { onUpdated(role, status) } },
    )
  }

  return (
    <ModalDialog
      titleId="membership-dialog-title"
      descriptionId="membership-dialog-description"
      onRequestClose={() => { if (!mutation.isPending) onClose() }}
    >
      {confirmSuspension ? (
        <div className="membership-form">
          <div>
            <p className="page-eyebrow">Confirm access removal</p>
            <h2 id="membership-dialog-title">Suspend {entry.user.displayName}?</h2>
            <p id="membership-dialog-description">They will immediately lose workspace access. Existing project assignments remain recorded for later review.</p>
          </div>
          {mutation.isError ? <p className="form-error" role="alert">{mutation.error.message}</p> : null}
          <div className="project-create-form__actions">
            <button ref={confirmButton} className="danger-button" type="button" disabled={mutation.isPending} onClick={submitUpdate}>
              {mutation.isPending ? 'Suspending…' : 'Suspend member'}
            </button>
            <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={() => { setConfirmSuspension(false) }}>Keep editing</button>
          </div>
        </div>
      ) : (
        <form
          className="membership-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (isSuspension) setConfirmSuspension(true)
            else submitUpdate()
          }}
        >
          <div>
            <p className="page-eyebrow">Member access</p>
            <h2 id="membership-dialog-title">Edit {entry.user.displayName}</h2>
            <p id="membership-dialog-description">Changes are checked against membership revision {entry.membership.revision} before they commit.</p>
          </div>
          <label className="settings-field">
            <span>Workspace role</span>
            <select value={role} onChange={(event) => { const next = parseRole(event.currentTarget.value); if (next) { setRole(next); if (next === 'owner') setStatus('active') } }}>
              {entry.allowedRoles.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
          </label>
          <label className="settings-field">
            <span>Access status</span>
            <select value={status} onChange={(event) => { const next = parseStatus(event.currentTarget.value); if (next) setStatus(next) }}>
              {(role === 'owner' ? statuses.filter((value) => value === 'active') : statuses).map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
            </select>
          </label>
          {mutation.isError ? <p className="form-error" role="alert">{mutation.error.message}</p> : null}
          <div className="project-create-form__actions">
            <button className="primary-button" type="submit" disabled={mutation.isPending || (role === entry.membership.role && status === entry.membership.status)}>
              {isSuspension ? 'Review suspension' : mutation.isPending ? 'Saving…' : 'Save access'}
            </button>
            <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</button>
          </div>
        </form>
      )}
    </ModalDialog>
  )
}

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1')
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function parseRole(value: string | null): WorkspaceRole | null {
  return roles.find((candidate) => candidate === value) ?? null
}

function parseStatus(value: string | null): MembershipStatus | null {
  return statuses.find((candidate) => candidate === value) ?? null
}

function formatLabel(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}
