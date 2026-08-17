import { useState, type SyntheticEvent } from 'react'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type {
  AssignableProjectRole,
  ProjectMembershipAdministrationData,
  ProjectMembershipEntry,
} from '../../data'
import type { ProjectId, ProjectMemberId, UserId } from '../../domain'
import { useConfirmationFocus } from '../../interactions/use-confirmation-focus'
import {
  useAddProjectMember,
  useProjectMembershipAdministration,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from './project-membership-queries'

const roles: readonly AssignableProjectRole[] = ['contributor', 'viewer']

export function ProjectMembershipPanel({
  projectId,
  canManage,
}: Readonly<{ projectId: ProjectId; canManage: boolean }>) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<ProjectMemberId | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const administration = useProjectMembershipAdministration(
    {
      projectId,
      ...(search ? { search } : {}),
      page: { number: page, size: 10 },
    },
    canManage,
  )
  const canMutate = administration.data
    ? ['active', 'paused', 'planned'].includes(administration.data.project.status)
    : false
  const editingEntry = administration.data?.members.items.find(
    ({ membership }) => membership.id === editingId,
  ) ?? null

  if (!canManage) return null

  return (
    <section className="work-panel" aria-labelledby="project-members-title">
      <div className="work-panel__header">
        <div>
          <p className="page-eyebrow">Governed access</p>
          <h2 id="project-members-title">Project members</h2>
        </div>
        {canMutate ? (
          <button
            className="primary-button"
            type="button"
            disabled={!administration.data || administration.data.eligibleUsers.length === 0}
            onClick={() => { setAnnouncement(''); setAdding(true) }}
          >
            Add member
          </button>
        ) : null}
      </div>

      <form
        className="project-member-search"
        role="search"
        onSubmit={(event) => {
          event.preventDefault()
          const value = new FormData(event.currentTarget).get('member-search')
          setSearch(typeof value === 'string' ? value.trim().slice(0, 100) : '')
          setPage(1)
        }}
      >
        <label>
          <span>Search project members</span>
          <input name="member-search" type="search" defaultValue={search} maxLength={100} />
        </label>
        <button className="secondary-button" type="submit">Search</button>
      </form>

      {administration.isPending ? (
        <div className="dashboard-state" role="status">Loading project members…</div>
      ) : administration.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h3>Project members are unavailable</h3>
          <p>{gatewayMessage(administration.error)}</p>
          <button className="secondary-button" type="button" onClick={() => void administration.refetch()}>
            Retry members
          </button>
        </div>
      ) : administration.data.members.items.length === 0 ? (
        <p className="project-activity-empty">No project members match this search.</p>
      ) : (
        <>
          <div className="analytics-table-scroll">
            <table className="analytics-table project-member-table">
              <caption className="visually-hidden">Project membership administration</caption>
              <thead>
                <tr><th scope="col">Member</th><th scope="col">Role</th><th scope="col">Workspace status</th><th scope="col">Assigned issues</th><th scope="col">Actions</th></tr>
              </thead>
              <tbody>
                {administration.data.members.items.map((entry) => (
                  <tr key={entry.membership.id}>
                    <th scope="row"><span>{entry.user.displayName}</span><small>{entry.user.email}</small></th>
                    <td>{formatRole(entry.membership.role)}</td>
                    <td>{formatRole(entry.workspaceStatus)}</td>
                    <td>{entry.assignedIssueCount}</td>
                    <td>
                      {!canMutate ? (
                        <span className="administration-protected">Read-only project</span>
                      ) : entry.membership.role === 'lead' ? (
                        <span className="administration-protected">Transfer lead to change</span>
                      ) : (
                        <button className="secondary-button" type="button" onClick={() => { setAnnouncement(''); setEditingId(entry.membership.id) }}>
                          Manage {entry.user.displayName}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <nav className="project-pagination" aria-label="Project member pages">
            <button className="secondary-button" type="button" disabled={page <= 1} onClick={() => { setPage((value) => value - 1); }}>Previous</button>
            <p>Page {page} of {Math.max(administration.data.members.pageCount, 1)}</p>
            <button className="secondary-button" type="button" disabled={page >= administration.data.members.pageCount} onClick={() => { setPage((value) => value + 1); }}>Next</button>
          </nav>
        </>
      )}

      {announcement ? <p className="visually-hidden" role="status">{announcement}</p> : null}
      {adding && administration.data ? (
        <AddProjectMemberDialog
          data={administration.data}
          onClose={() => { setAdding(false); }}
          onAdded={(name) => { setPage(1); setAnnouncement(`${name} was added to the project.`); setAdding(false) }}
        />
      ) : null}
      {editingEntry && administration.data ? (
        <ManageProjectMemberDialog
          data={administration.data}
          entry={editingEntry}
          onClose={() => { setEditingId(null); }}
          onChanged={(message) => { setPage(1); setAnnouncement(message); setEditingId(null) }}
        />
      ) : null}
    </section>
  )
}

function AddProjectMemberDialog({
  data,
  onClose,
  onAdded,
}: Readonly<{
  data: ProjectMembershipAdministrationData
  onClose: () => void
  onAdded: (name: string) => void
}>) {
  const mutation = useAddProjectMember(data.project.id)
  const [userId, setUserId] = useState<UserId | null>(data.eligibleUsers[0]?.id ?? null)
  const [role, setRole] = useState<AssignableProjectRole>('contributor')
  const selected = data.eligibleUsers.find(({ id }) => id === userId)
  return (
    <ModalDialog titleId="add-project-member-title" descriptionId="add-project-member-description" onRequestClose={() => { if (!mutation.isPending) onClose() }}>
      <form
        className="membership-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!userId || !selected) return
          mutation.mutate(
            { projectId: data.project.id, expectedProjectRevision: data.project.revision, userId, role },
            { onSuccess: () => { onAdded(selected.displayName); } },
          )
        }}
      >
        <div><p className="page-eyebrow">Project access</p><h2 id="add-project-member-title">Add project member</h2><p id="add-project-member-description">Only active workspace members are eligible.</p></div>
        <label className="settings-field"><span>Member</span><select value={userId ?? ''} onChange={(event) => { setUserId(event.currentTarget.value as UserId); }}>{data.eligibleUsers.map((user) => <option key={user.id} value={user.id}>{user.displayName} · {user.email}</option>)}</select></label>
        <label className="settings-field"><span>Project role</span><select value={role} onChange={(event) => { setRole(event.currentTarget.value as AssignableProjectRole); }}>{roles.map((value) => <option key={value} value={value}>{formatRole(value)}</option>)}</select></label>
        {mutation.isError ? <p className="form-error" role="alert">{gatewayMessage(mutation.error)}</p> : null}
        <div className="project-create-form__actions"><button className="primary-button" type="submit" disabled={mutation.isPending || !userId}>{mutation.isPending ? 'Adding…' : 'Add member'}</button><button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</button></div>
      </form>
    </ModalDialog>
  )
}

function ManageProjectMemberDialog({
  data,
  entry,
  onClose,
  onChanged,
}: Readonly<{
  data: ProjectMembershipAdministrationData
  entry: ProjectMembershipEntry
  onClose: () => void
  onChanged: (message: string) => void
}>) {
  const update = useUpdateProjectMember(data.project.id)
  const remove = useRemoveProjectMember(data.project.id)
  const [role, setRole] = useState<AssignableProjectRole>(
    entry.membership.role === 'lead' ? 'viewer' : entry.membership.role,
  )
  const [confirmRemove, setConfirmRemove] = useState(false)
  const candidates = data.reassignmentUsers.filter(({ id }) => id !== entry.user.id)
  const [reassignTo, setReassignTo] = useState<UserId | null>(candidates[0]?.id ?? null)
  const { confirmationRef, triggerRef } = useConfirmationFocus(confirmRemove)

  if (confirmRemove) {
    return (
      <ModalDialog titleId="remove-project-member-title" descriptionId="remove-project-member-description" onRequestClose={() => { if (!remove.isPending) setConfirmRemove(false) }}>
        <div className="membership-form">
          <div><p className="page-eyebrow">Confirm project removal</p><h2 id="remove-project-member-title">Remove {entry.user.displayName}?</h2><p id="remove-project-member-description">Their project access ends immediately. Assigned work must remain owned.</p></div>
          {entry.assignedIssueCount > 0 ? <label className="settings-field"><span>Reassign {entry.assignedIssueCount} assigned {entry.assignedIssueCount === 1 ? 'issue' : 'issues'} to</span><select value={reassignTo ?? ''} onChange={(event) => { setReassignTo(event.currentTarget.value as UserId); }}>{candidates.map((user) => <option key={user.id} value={user.id}>{user.displayName}</option>)}</select></label> : null}
          {remove.isError ? <p className="form-error" role="alert">{gatewayMessage(remove.error)}</p> : null}
          <div className="project-create-form__actions"><button ref={confirmationRef} className="danger-button" type="button" disabled={remove.isPending || (entry.assignedIssueCount > 0 && !reassignTo)} onClick={() => { remove.mutate({ id: entry.membership.id, expectedProjectRevision: data.project.revision, reassignIssuesTo: entry.assignedIssueCount > 0 ? reassignTo : null }, { onSuccess: () => { onChanged(`${entry.user.displayName} was removed from the project.`); } }); }}>{remove.isPending ? 'Removing…' : 'Remove member'}</button><button className="secondary-button" type="button" disabled={remove.isPending} onClick={() => { setConfirmRemove(false); }}>Keep member</button></div>
        </div>
      </ModalDialog>
    )
  }

  return (
    <ModalDialog titleId="manage-project-member-title" descriptionId="manage-project-member-description" onRequestClose={() => { if (!update.isPending) onClose() }}>
      <form className="membership-form" onSubmit={(event: SyntheticEvent<HTMLFormElement>) => { event.preventDefault(); update.mutate({ id: entry.membership.id, expectedProjectRevision: data.project.revision, role }, { onSuccess: () => { onChanged(`${entry.user.displayName} is now a ${role}.`); } }) }}>
        <div><p className="page-eyebrow">Project access</p><h2 id="manage-project-member-title">Manage {entry.user.displayName}</h2><p id="manage-project-member-description">Role changes use project revision {data.project.revision}.</p></div>
        <label className="settings-field"><span>Project role</span><select value={role} onChange={(event) => { setRole(event.currentTarget.value as AssignableProjectRole); }}>{roles.map((value) => <option key={value} value={value}>{formatRole(value)}</option>)}</select></label>
        {update.isError ? <p className="form-error" role="alert">{gatewayMessage(update.error)}</p> : null}
        <div className="project-create-form__actions"><button className="primary-button" type="submit" disabled={update.isPending || role === entry.membership.role}>{update.isPending ? 'Saving…' : 'Save role'}</button><button ref={triggerRef} className="danger-button" type="button" disabled={update.isPending} onClick={() => { setConfirmRemove(true); }}>Remove from project</button><button className="secondary-button" type="button" disabled={update.isPending} onClick={onClose}>Cancel</button></div>
      </form>
    </ModalDialog>
  )
}

function formatRole(value: string): string {
  return value.charAt(0).toLocaleUpperCase() + value.slice(1)
}

function gatewayMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The project membership request failed.'
}
