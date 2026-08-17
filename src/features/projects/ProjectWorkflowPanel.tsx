import { useRef, useState, type SyntheticEvent } from 'react'

import { ModalDialog } from '../../components/dialog/ModalDialog'
import type {
  ProjectWorkflowAdministrationData,
  ProjectWorkflowAdministrationEntry,
} from '../../data'
import type {
  ProjectId,
  WorkflowStatusCategory,
  WorkflowStatusId,
} from '../../domain'
import {
  useProjectWorkflowAdministration,
  useUpdateProjectWorkflow,
} from './project-workflow-queries'

const categories: readonly WorkflowStatusCategory[] = [
  'backlog',
  'unstarted',
  'started',
  'completed',
  'canceled',
]

interface DraftStage {
  readonly key: string
  readonly id: WorkflowStatusId | null
  readonly issueCount: number
  readonly name: string
  readonly category: WorkflowStatusCategory
}

interface RetiredStage {
  readonly id: WorkflowStatusId
  readonly name: string
  readonly issueCount: number
  readonly reassignToStatusId: WorkflowStatusId | null
}

export function ProjectWorkflowPanel({
  projectId,
  canManage,
}: Readonly<{ projectId: ProjectId; canManage: boolean }>) {
  const [editing, setEditing] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const workflow = useProjectWorkflowAdministration(projectId, canManage)
  const canMutate = workflow.data
    ? ['active', 'paused', 'planned'].includes(workflow.data.project.status)
    : false

  if (!canManage) return null

  return (
    <section className="work-panel" aria-labelledby="project-workflow-title">
      <div className="work-panel__header">
        <div>
          <p className="page-eyebrow">Delivery policy</p>
          <h2 id="project-workflow-title">Project workflow</h2>
        </div>
        {canMutate ? (
          <button
            className="secondary-button"
            type="button"
            disabled={!workflow.data}
            onClick={() => { setAnnouncement(''); setEditing(true) }}
          >
            Configure workflow
          </button>
        ) : null}
      </div>
      {workflow.isPending ? (
        <div className="dashboard-state" role="status">Loading workflow configuration…</div>
      ) : workflow.isError ? (
        <div className="dashboard-state dashboard-state--error" role="alert">
          <h3>Workflow configuration is unavailable</h3>
          <p>{gatewayMessage(workflow.error)}</p>
          <button className="secondary-button" type="button" onClick={() => void workflow.refetch()}>
            Retry workflow
          </button>
        </div>
      ) : (
        <div className="analytics-table-scroll">
          <table className="analytics-table project-workflow-table">
            <caption className="visually-hidden">Project workflow administration</caption>
            <thead><tr><th scope="col">Order</th><th scope="col">Status</th><th scope="col">Category</th><th scope="col">Issues</th></tr></thead>
            <tbody>
              {workflow.data.statuses.map(({ status, issueCount }) => (
                <tr key={status.id}>
                  <td>{status.order + 1}</td>
                  <th scope="row">{status.name}</th>
                  <td>{formatCategory(status.category)}</td>
                  <td>{issueCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!canMutate && workflow.data ? (
        <p className="project-readonly-notice">Reactivate this project before changing its workflow.</p>
      ) : null}
      {announcement ? <p className="visually-hidden" role="status">{announcement}</p> : null}
      {editing && workflow.data ? (
        <WorkflowEditorDialog
          data={workflow.data}
          onClose={() => { setEditing(false) }}
          onUpdated={() => {
            setAnnouncement('Project workflow was updated.')
            setEditing(false)
          }}
        />
      ) : null}
    </section>
  )
}

function WorkflowEditorDialog({
  data,
  onClose,
  onUpdated,
}: Readonly<{
  data: ProjectWorkflowAdministrationData
  onClose: () => void
  onUpdated: () => void
}>) {
  const mutation = useUpdateProjectWorkflow(data.project.id)
  const nextKey = useRef(0)
  const [stages, setStages] = useState<readonly DraftStage[]>(() => toDraftStages(data.statuses))
  const [retired, setRetired] = useState<readonly RetiredStage[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)

  const resetDraft = () => {
    setStages(toDraftStages(data.statuses))
    setRetired([])
    setValidationError(null)
    mutation.reset()
  }
  const updateStage = (key: string, changes: Partial<Pick<DraftStage, 'category' | 'name'>>) => {
    setStages((current) => current.map((stage) =>
      stage.key === key ? { ...stage, ...changes } : stage,
    ))
  }
  const moveStage = (index: number, offset: -1 | 1) => {
    setStages((current) => {
      const target = index + offset
      if (target < 0 || target >= current.length) return current
      const reordered = [...current]
      const [stage] = reordered.splice(index, 1)
      if (!stage) return current
      reordered.splice(target, 0, stage)
      return reordered
    })
  }
  const removeStage = (stage: DraftStage) => {
    if (stages.length <= 2) {
      setValidationError('A workflow must keep at least two statuses.')
      return
    }
    const remaining = stages.filter(({ key }) => key !== stage.key)
    const remainingIds = remaining.flatMap(({ id }) => id ? [id] : [])
    if (stage.id && stage.issueCount > 0 && remainingIds.length === 0) {
      setValidationError('Keep an existing status available to receive migrated issues.')
      return
    }
    setStages(remaining)
    setRetired((current) => {
      const withoutInvalidTargets = current.map((candidate) =>
        candidate.reassignToStatusId === stage.id
          ? { ...candidate, reassignToStatusId: null }
          : candidate,
      )
      return stage.id && stage.issueCount > 0
        ? [...withoutInvalidTargets, {
            id: stage.id,
            name: stage.name,
            issueCount: stage.issueCount,
            reassignToStatusId: remainingIds[0] ?? null,
          }]
        : withoutInvalidTargets
    })
    setValidationError(null)
  }
  const addStage = () => {
    if (stages.length >= 10) {
      setValidationError('A workflow may contain at most ten statuses.')
      return
    }
    nextKey.current += 1
    setStages((current) => [...current, {
      key: `new-${nextKey.current.toString()}`,
      id: null,
      issueCount: 0,
      name: '',
      category: 'unstarted',
    }])
    setValidationError(null)
  }
  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    const error = validateDraft(stages, retired)
    setValidationError(error)
    if (error) return
    mutation.mutate({
      projectId: data.project.id,
      expectedProjectRevision: data.project.revision,
      statuses: stages.map(({ id, name, category }) => ({ id, name, category })),
      migrations: retired.flatMap(({ id, reassignToStatusId }) =>
        reassignToStatusId ? [{ statusId: id, reassignToStatusId }] : [],
      ),
    }, { onSuccess: onUpdated })
  }
  const retainedTargets = stages.flatMap(({ id, name }) => id ? [{ id, name }] : [])

  return (
    <ModalDialog
      titleId="workflow-editor-title"
      descriptionId="workflow-editor-description"
      onRequestClose={() => { if (!mutation.isPending) onClose() }}
    >
      <form className="workflow-editor" onSubmit={submit}>
        <div>
          <p className="page-eyebrow">Authoritative workflow</p>
          <h2 id="workflow-editor-title">Configure project workflow</h2>
          <p id="workflow-editor-description">Order stages and migrate work before retiring a status. Changes use project revision {data.project.revision}.</p>
        </div>
        {validationError ? <p className="form-error" role="alert">{validationError}</p> : null}
        {mutation.isError ? (
          <div className="form-error" role="alert">
            <p>{gatewayMessage(mutation.error)}</p>
            <button className="secondary-button" type="button" onClick={resetDraft}>Reload latest workflow</button>
          </div>
        ) : null}
        <ol className="workflow-editor__stages" aria-label="Ordered workflow statuses">
          {stages.map((stage, index) => (
            <li key={stage.key} className="workflow-editor__stage">
              <span className="workflow-editor__order" aria-hidden="true">{index + 1}</span>
              <label><span>Status name</span><input aria-label={`Status ${(index + 1).toString()} name`} value={stage.name} maxLength={60} onChange={(event) => { updateStage(stage.key, { name: event.currentTarget.value }) }} /></label>
              <label><span>Category</span><select aria-label={`Status ${(index + 1).toString()} category`} value={stage.category} onChange={(event) => { updateStage(stage.key, { category: event.currentTarget.value as WorkflowStatusCategory }) }}>{categories.map((category) => <option key={category} value={category}>{formatCategory(category)}</option>)}</select></label>
              <span className="workflow-editor__count">{stage.issueCount} {stage.issueCount === 1 ? 'issue' : 'issues'}</span>
              <div className="workflow-editor__actions">
                <button className="secondary-button" type="button" disabled={index === 0} onClick={() => { moveStage(index, -1) }}>Move {stage.name || `status ${(index + 1).toString()}`} up</button>
                <button className="secondary-button" type="button" disabled={index === stages.length - 1} onClick={() => { moveStage(index, 1) }}>Move {stage.name || `status ${(index + 1).toString()}`} down</button>
                <button className="danger-button" type="button" disabled={stages.length <= 2} onClick={() => { removeStage(stage) }}>Retire {stage.name || `status ${(index + 1).toString()}`}</button>
              </div>
            </li>
          ))}
        </ol>
        <button className="secondary-button" type="button" disabled={stages.length >= 10} onClick={addStage}>Add status</button>
        {retired.length > 0 ? (
          <fieldset className="workflow-editor__migrations">
            <legend>Required issue migrations</legend>
            {retired.map((stage) => (
              <label key={stage.id}>
                <span>Move {stage.issueCount} {stage.issueCount === 1 ? 'issue' : 'issues'} from {stage.name} to</span>
                <select value={stage.reassignToStatusId ?? ''} onChange={(event) => {
                  setRetired((current) => current.map((candidate) =>
                    candidate.id === stage.id
                      ? { ...candidate, reassignToStatusId: event.currentTarget.value as WorkflowStatusId }
                      : candidate,
                  ))
                }}>
                  <option value="">Choose a retained status</option>
                  {retainedTargets.map((target) => <option key={target.id} value={target.id}>{target.name}</option>)}
                </select>
              </label>
            ))}
          </fieldset>
        ) : null}
        <div className="project-create-form__actions">
          <button className="primary-button" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Saving workflow…' : 'Save workflow'}</button>
          <button className="secondary-button" type="button" disabled={mutation.isPending} onClick={onClose}>Cancel</button>
        </div>
      </form>
    </ModalDialog>
  )
}

function toDraftStages(entries: readonly ProjectWorkflowAdministrationEntry[]): readonly DraftStage[] {
  return entries.map(({ status, issueCount }) => ({
    key: status.id,
    id: status.id,
    issueCount,
    name: status.name,
    category: status.category,
  }))
}

function validateDraft(
  stages: readonly DraftStage[],
  retired: readonly RetiredStage[],
): string | null {
  const names = stages.map(({ name }) => name.trim().toLocaleLowerCase())
  if (names.some((name) => name.length === 0)) return 'Give every workflow status a name.'
  if (new Set(names).size !== names.length) return 'Workflow status names must be unique.'
  if (!stages.some(({ category }) => category === 'completed')) {
    return 'Keep at least one completed workflow status.'
  }
  if (!stages.some(({ category }) => category !== 'completed' && category !== 'canceled')) {
    return 'Keep at least one status for open work.'
  }
  if (retired.some(({ reassignToStatusId }) => !reassignToStatusId)) {
    return 'Choose a migration target for every retired status with issues.'
  }
  return null
}

function formatCategory(category: string): string {
  return category.charAt(0).toLocaleUpperCase() + category.slice(1)
}

function gatewayMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The workflow request failed.'
}
