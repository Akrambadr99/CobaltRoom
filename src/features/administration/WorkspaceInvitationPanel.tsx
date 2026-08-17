import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type {
  WorkspaceInvitationEffectiveState,
  WorkspaceInvitationEntry,
} from '../../data'
import type { WorkspaceInvitationRole } from '../../domain'
import { useAppServices } from '../../app/providers/app-services-context'
import {
  useActivateWorkspaceInvitation,
  useCreateWorkspaceInvitation,
  useResendWorkspaceInvitation,
  useRevokeWorkspaceInvitation,
  useWorkspaceInvitations,
} from './invitation-queries'

const invitationRoles: readonly WorkspaceInvitationRole[] = [
  'admin',
  'member',
  'viewer',
]
const invitationStates: readonly WorkspaceInvitationEffectiveState[] = [
  'pending',
  'expired',
  'accepted',
  'revoked',
]

type InvitationAction =
  | { readonly kind: 'activate'; readonly entry: WorkspaceInvitationEntry }
  | { readonly kind: 'revoke'; readonly entry: WorkspaceInvitationEntry }

export function WorkspaceInvitationPanel() {
  const { workspaceId } = useAppServices()
  const [parameters, setParameters] = useSearchParams()
  const page = parsePage(parameters.get('invitePage'))
  const search = parameters.get('inviteQ')?.slice(0, 100) ?? ''
  const role = parseInvitationRole(parameters.get('inviteRole'))
  const state = parseInvitationState(parameters.get('inviteState'))
  const [creating, setCreating] = useState(false)
  const [action, setAction] = useState<InvitationAction | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const resend = useResendWorkspaceInvitation()
  const query = {
    workspaceId,
    ...(search ? { search } : {}),
    ...(role ? { roles: [role] } : {}),
    ...(state ? { states: [state] } : {}),
    page: { number: page, size: 10 },
  }
  const invitations = useWorkspaceInvitations(query)
  const currentActionEntry = action
    ? (invitations.data?.invitations.items.find(
        ({ invitation }) => invitation.id === action.entry.invitation.id,
      ) ?? action.entry)
    : null

  useEffect(() => {
    if (!invitations.data) return
    const lastPage = Math.max(invitations.data.invitations.pageCount, 1)
    if (page <= lastPage) return
    setParameters((current) => {
      const next = new URLSearchParams(current)
      if (lastPage === 1) next.delete('invitePage')
      else next.set('invitePage', String(lastPage))
      return next
    })
  }, [invitations.data, page, setParameters])

  const updateParameters = (changes: Record<string, string | null>): void => {
    setParameters((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value) next.set(key, value)
        else next.delete(key)
      }
      if (!('invitePage' in changes)) next.delete('invitePage')
      return next
    })
  }

  return (
    <section className="work-panel" aria-labelledby="workspace-invitations-title">
      <div className="work-panel__header">
        <div>
          <p className="page-eyebrow">Provisioning lifecycle</p>
          <h2 id="workspace-invitations-title">Workspace invitations</h2>
        </div>
        <button
          className="primary-button"
          type="button"
          onClick={() => {
            setAnnouncement('')
            setCreating(true)
          }}
        >
          Invite member
        </button>
      </div>

      <form
        className="administration-filters"
        role="search"
        aria-label="Filter workspace invitations"
        onSubmit={(event) => {
          event.preventDefault()
          const value = new FormData(event.currentTarget).get('invitationSearch')
          updateParameters({
            inviteQ:
              typeof value === 'string' ? value.trim().slice(0, 100) : null,
          })
        }}
      >
        <label>
          <span>Search invitations</span>
          <input
            key={search}
            name="invitationSearch"
            type="search"
            defaultValue={search}
            maxLength={100}
          />
        </label>
        <label>
          <span>Invitation role</span>
          <select
            value={role ?? ''}
            onChange={(event) => {
              updateParameters({ inviteRole: event.currentTarget.value || null })
            }}
          >
            <option value="">All roles</option>
            {invitationRoles.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Invitation status</span>
          <select
            value={state ?? ''}
            onChange={(event) => {
              updateParameters({ inviteState: event.currentTarget.value || null })
            }}
          >
            <option value="">All statuses</option>
            {invitationStates.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
        </label>
        <button className="secondary-button" type="submit">Search</button>
      </form>

      {resend.isError ? (
        <p className="form-error" role="alert">{resend.error.message}</p>
      ) : null}
      {invitations.isPending ? (
        <div className="dashboard-state" role="status">Loading invitations…</div>
      ) : invitations.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <p>The invitation directory could not be loaded.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void invitations.refetch()}
          >
            Retry invitations
          </button>
        </div>
      ) : invitations.data.invitations.items.length === 0 ? (
        <p className="project-activity-empty">No invitations match these filters.</p>
      ) : (
        <div className="analytics-table-scroll">
          <table className="analytics-table administration-table invitation-table">
            <caption className="visually-hidden">Workspace invitation administration</caption>
            <thead>
              <tr>
                <th scope="col">Recipient</th>
                <th scope="col">Role</th>
                <th scope="col">Status</th>
                <th scope="col">Last sent</th>
                <th scope="col">Expires</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.data.invitations.items.map((entry) => (
                <tr key={entry.invitation.id}>
                  <th scope="row">{entry.invitation.email}</th>
                  <td>{formatLabel(entry.invitation.role)}</td>
                  <td>
                    <span className={`membership-status membership-status--${entry.effectiveState}`}>
                      {formatLabel(entry.effectiveState)}
                    </span>
                  </td>
                  <td>{formatDate(entry.invitation.lastSentAt)}</td>
                  <td>{formatDate(entry.invitation.expiresAt)}</td>
                  <td>
                    {entry.effectiveState === 'pending' ? (
                      <div className="invitation-actions">
                        <button
                          className="secondary-button"
                          type="button"
                          onClick={() => { setAction({ kind: 'activate', entry }) }}
                        >
                          Activate
                        </button>
                        <InvitationResendButton
                          entry={entry}
                          pending={resend.isPending}
                          onResend={() => {
                            resend.mutate(
                              {
                                id: entry.invitation.id,
                                expectedRevision: entry.invitation.revision,
                              },
                              {
                                onSuccess: () => {
                                  setAnnouncement(
                                    `Invitation resent to ${entry.invitation.email}.`,
                                  )
                                },
                              },
                            )
                          }}
                        />
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => { setAction({ kind: 'revoke', entry }) }}
                        >
                          Revoke
                        </button>
                      </div>
                    ) : entry.effectiveState === 'expired' ? (
                      <div className="invitation-actions">
                        <InvitationResendButton
                          entry={entry}
                          pending={resend.isPending}
                          onResend={() => {
                            resend.mutate(
                              {
                                id: entry.invitation.id,
                                expectedRevision: entry.invitation.revision,
                              },
                              {
                                onSuccess: () => {
                                  setAnnouncement(
                                    `Invitation renewed for ${entry.invitation.email}.`,
                                  )
                                },
                              },
                            )
                          }}
                        />
                        <button
                          className="danger-button"
                          type="button"
                          onClick={() => { setAction({ kind: 'revoke', entry }) }}
                        >
                          Revoke
                        </button>
                      </div>
                    ) : (
                      <span className="administration-protected">Complete</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invitations.data ? (
        <nav className="governance-pagination" aria-label="Invitation directory pages">
          <button
            className="secondary-button"
            type="button"
            disabled={page <= 1}
            onClick={() => { updateParameters({ invitePage: String(page - 1) }) }}
          >
            Previous
          </button>
          <span>
            Page {page} of {Math.max(invitations.data.invitations.pageCount, 1)}
          </span>
          <button
            className="secondary-button"
            type="button"
            disabled={page >= invitations.data.invitations.pageCount}
            onClick={() => { updateParameters({ invitePage: String(page + 1) }) }}
          >
            Next
          </button>
        </nav>
      ) : null}
      {announcement ? (
        <p className="visually-hidden" role="status" aria-live="polite">
          {announcement}
        </p>
      ) : null}

      {creating ? (
        <CreateInvitationDialog
          onClose={() => { setCreating(false) }}
          onCreated={(email) => {
            setAnnouncement(`Invitation created for ${email}.`)
            setCreating(false)
          }}
        />
      ) : null}
      {action?.kind === 'activate' && currentActionEntry ? (
        <ActivateInvitationDialog
          entry={currentActionEntry}
          onClose={() => { setAction(null) }}
          onActivated={(name) => {
            setAnnouncement(`${name} was provisioned as an active workspace member.`)
            setAction(null)
          }}
        />
      ) : null}
      {action?.kind === 'revoke' && currentActionEntry ? (
        <RevokeInvitationDialog
          entry={currentActionEntry}
          onClose={() => { setAction(null) }}
          onRevoked={() => {
            setAnnouncement(`Invitation revoked for ${currentActionEntry.invitation.email}.`)
            setAction(null)
          }}
        />
      ) : null}
    </section>
  )
}

function InvitationResendButton({
  entry,
  pending,
  onResend,
}: Readonly<{
  entry: WorkspaceInvitationEntry
  pending: boolean
  onResend: () => void
}>) {
  return (
    <button
      className="secondary-button"
      type="button"
      disabled={pending}
      onClick={onResend}
    >
      {pending ? 'Sending…' : entry.effectiveState === 'expired' ? 'Renew' : 'Resend'}
    </button>
  )
}

function CreateInvitationDialog({
  onClose,
  onCreated,
}: Readonly<{ onClose: () => void; onCreated: (email: string) => void }>) {
  const { workspaceId } = useAppServices()
  const mutation = useCreateWorkspaceInvitation()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceInvitationRole>('member')
  return (
    <ModalDialog
      titleId="create-invitation-title"
      descriptionId="create-invitation-description"
      onRequestClose={() => { if (!mutation.isPending) onClose() }}
    >
      <form
        className="membership-form"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate(
            { workspaceId, email, role },
            { onSuccess: (invitation) => { onCreated(invitation.email) } },
          )
        }}
      >
        <h2 id="create-invitation-title">Invite workspace member</h2>
        <p id="create-invitation-description">
          Invitations expire after seven days and do not grant access until activation.
        </p>
        {mutation.isError ? <p className="form-error" role="alert">{mutation.error.message}</p> : null}
        <label>
          <span>Email address</span>
          <input
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => { setEmail(event.currentTarget.value) }}
          />
        </label>
        <label>
          <span>Invitation role</span>
          <select
            value={role}
            onChange={(event) => {
              const next = parseInvitationRole(event.currentTarget.value)
              if (next) setRole(next)
            }}
          >
            {invitationRoles.map((value) => (
              <option key={value} value={value}>{formatLabel(value)}</option>
            ))}
          </select>
        </label>
        <div className="project-create-form__actions">
          <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Inviting…' : 'Create invitation'}</button>
        </div>
      </form>
    </ModalDialog>
  )
}

function ActivateInvitationDialog({
  entry,
  onClose,
  onActivated,
}: Readonly<{
  entry: WorkspaceInvitationEntry
  onClose: () => void
  onActivated: (name: string) => void
}>) {
  const mutation = useActivateWorkspaceInvitation()
  const [displayName, setDisplayName] = useState('')
  return (
    <ModalDialog
      titleId="activate-invitation-title"
      descriptionId="activate-invitation-description"
      onRequestClose={() => { if (!mutation.isPending) onClose() }}
    >
      <form
        className="membership-form"
        onSubmit={(event) => {
          event.preventDefault()
          mutation.mutate(
            {
              id: entry.invitation.id,
              expectedRevision: entry.invitation.revision,
              displayName,
            },
            { onSuccess: (result) => { onActivated(result.user.displayName) } },
          )
        }}
      >
        <h2 id="activate-invitation-title">Activate {entry.invitation.email}</h2>
        <p id="activate-invitation-description">
          Activation provisions an active {entry.invitation.role} membership.
        </p>
        {mutation.isError ? <p className="form-error" role="alert">{mutation.error.message}</p> : null}
        <label>
          <span>Member name</span>
          <input
            autoComplete="name"
            required
            maxLength={120}
            value={displayName}
            onChange={(event) => { setDisplayName(event.currentTarget.value) }}
          />
        </label>
        <div className="project-create-form__actions">
          <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Activating…' : 'Activate member'}</button>
        </div>
      </form>
    </ModalDialog>
  )
}

function RevokeInvitationDialog({
  entry,
  onClose,
  onRevoked,
}: Readonly<{
  entry: WorkspaceInvitationEntry
  onClose: () => void
  onRevoked: () => void
}>) {
  const mutation = useRevokeWorkspaceInvitation()
  return (
    <ModalDialog
      titleId="revoke-invitation-title"
      descriptionId="revoke-invitation-description"
      onRequestClose={() => { if (!mutation.isPending) onClose() }}
    >
      <div className="membership-form">
        <h2 id="revoke-invitation-title">Revoke invitation?</h2>
        <p id="revoke-invitation-description">
          {entry.invitation.email} will no longer be eligible for activation.
        </p>
        {mutation.isError ? <p className="form-error" role="alert">{mutation.error.message}</p> : null}
        <div className="project-create-form__actions">
          <button
            className="danger-button"
            type="button"
            disabled={mutation.isPending}
            onClick={() => {
              mutation.mutate(
                {
                  id: entry.invitation.id,
                  expectedRevision: entry.invitation.revision,
                },
                { onSuccess: onRevoked },
              )
            }}
          >
            {mutation.isPending ? 'Revoking…' : 'Revoke invitation'}
          </button>
          <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Keep invitation</button>
        </div>
      </div>
    </ModalDialog>
  )
}

function parsePage(value: string | null): number {
  const parsed = Number(value ?? '1')
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1
}

function parseInvitationRole(value: string | null): WorkspaceInvitationRole | null {
  return invitationRoles.find((candidate) => candidate === value) ?? null
}

function parseInvitationState(
  value: string | null,
): WorkspaceInvitationEffectiveState | null {
  return invitationStates.find((candidate) => candidate === value) ?? null
}

function formatLabel(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}

function formatDate(value: string): string {
  return value.slice(0, 10)
}
