import { useEffect, useRef, useState, type SyntheticEvent } from 'react'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import { GatewayError } from '../../data/gateway/errors'
import type { ProjectId, ProjectMemberRole, UserId } from '../../domain'
import {
  useProjectLeadTransfer,
  useTransferProjectLead,
} from './project-lead-queries'

interface ProjectLeadTransferDialogProps {
  readonly authorized: boolean
  readonly projectId: ProjectId
  readonly onClose: () => void
  readonly onTransferred: (message: string) => void
}

export function ProjectLeadTransferDialog({
  authorized,
  projectId,
  onClose,
  onTransferred,
}: ProjectLeadTransferDialogProps) {
  const transferData = useProjectLeadTransfer(projectId, authorized)
  const transfer = useTransferProjectLead(projectId)
  const accessLostCloseRef = useRef<HTMLButtonElement>(null)
  const [newLeadId, setNewLeadId] = useState<UserId | null>(null)
  const [formerLeadRole, setFormerLeadRole] =
    useState<Exclude<ProjectMemberRole, 'lead'>>('contributor')

  const effectiveNewLeadId = transferData.data?.candidates.some(
    ({ user }) => user.id === newLeadId,
  )
    ? newLeadId
    : (transferData.data?.candidates[0]?.user.id ?? null)

  useEffect(() => {
    if (!authorized) accessLostCloseRef.current?.focus()
  }, [authorized])

  const submit = (event: SyntheticEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const data = transferData.data
    if (!data || !effectiveNewLeadId || !authorized) return
    const selected = data.candidates.find(
      ({ user }) => user.id === effectiveNewLeadId,
    )
    if (!selected) return
    transfer.mutate(
      {
        projectId,
        expectedProjectRevision: data.project.revision,
        expectedCurrentLeadId: data.currentLead.id,
        newLeadId: effectiveNewLeadId,
        formerLeadRole,
      },
      {
        onSuccess: () => {
          onTransferred(
            `${selected.user.displayName} is now the project lead.`,
          )
        },
      },
    )
  }

  const close = (): void => {
    if (!transfer.isPending) onClose()
  }

  return (
    <ModalDialog
      titleId="project-lead-transfer-title"
      descriptionId="project-lead-transfer-description"
      onRequestClose={close}
    >
      <form className="project-lifecycle-form" onSubmit={submit}>
        <h2 id="project-lead-transfer-title">Transfer project leadership</h2>
        <p id="project-lead-transfer-description">
          Leadership changes immediately update project permissions and member roles.
        </p>
        {authorized && transfer.error ? (
          <p className="form-error" role="alert">{gatewayMessage(transfer.error)}</p>
        ) : null}

        {!authorized ? (
          <div className="dashboard-state dashboard-state--error" role="alert">
            <p>Your permission to transfer this project changed while the dialog was open.</p>
            <button
              ref={accessLostCloseRef}
              className="secondary-button"
              type="button"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        ) : transferData.isPending ? (
          <p role="status">Loading eligible project members…</p>
        ) : transferData.isError ? (
          <div className="dashboard-state dashboard-state--error" role="alert">
            <p>{gatewayMessage(transferData.error)}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() => void transferData.refetch()}
            >
              Retry eligible members
            </button>
          </div>
        ) : transferData.data.candidates.length === 0 ? (
          <div className="dashboard-state">
            <p>No other active project member is eligible to become lead.</p>
            <button className="secondary-button" type="button" onClick={onClose}>
              Close
            </button>
          </div>
        ) : (
          <>
            <dl className="lead-transfer-summary">
              <div>
                <dt>Current lead</dt>
                <dd>{transferData.data.currentLead.displayName}</dd>
              </div>
              <div>
                <dt>Project revision</dt>
                <dd>{transferData.data.project.revision}</dd>
              </div>
            </dl>
            <label>
              <span>New project lead</span>
              <select
                value={effectiveNewLeadId ?? ''}
                disabled={transfer.isPending}
                onChange={(event) => {
                  setNewLeadId(event.currentTarget.value as UserId)
                }}
              >
                {transferData.data.candidates.map(({ currentRole, user }) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} · {formatRole(currentRole)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Former lead’s new role</span>
              <select
                value={formerLeadRole}
                disabled={transfer.isPending}
                onChange={(event) => {
                  setFormerLeadRole(
                    event.currentTarget.value as Exclude<ProjectMemberRole, 'lead'>,
                  )
                }}
              >
                <option value="contributor">Contributor</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            <p className="lead-transfer-confirmation">
              Confirming will grant the selected member lead permissions and remove
              lead permissions from {transferData.data.currentLead.displayName}.
            </p>
            <div className="project-lifecycle-form__actions">
              <button
                className="secondary-button"
                type="button"
                disabled={transfer.isPending}
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="submit"
                disabled={transfer.isPending || !effectiveNewLeadId}
              >
                {transfer.isPending ? 'Transferring…' : 'Transfer leadership'}
              </button>
            </div>
          </>
        )}
      </form>
    </ModalDialog>
  )
}

function formatRole(role: Exclude<ProjectMemberRole, 'lead'>): string {
  return role === 'contributor' ? 'Contributor' : 'Viewer'
}

function gatewayMessage(error: unknown): string {
  if (error instanceof GatewayError) return error.message
  return error instanceof Error
    ? error.message
    : 'The leadership request did not complete.'
}
