/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; immutable: true }
export interface MeterCaseClosure { id: string; caseId: string; followUpId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: 0; reviewedBy: string; closedOn: string; immutable: true }
export interface MeterWorkloadState { revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[]; closures: MeterCaseClosure[] }
export const initialMeterWorkloadState: MeterWorkloadState = { revision: 0, cases: structuredClone(seededMeterCases), followUps: [], closures: [] }
interface CoordinateFollowUp { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; owner: string; scheduledOn: string; asOf: string; contactEvidence: string; escalationReason: string }

export function coordinateMeterFollowUp(state: MeterWorkloadState, command: CoordinateFollowUp) {
  if (state.followUps.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Meter workload changed. Refresh before coordinating follow-up.')
  if (command.role !== 'Operations Supervisor') throw new Error('Only an operations supervisor can coordinate both owners.')
  const source = state.cases.find((item) => item.caseId === command.caseId)
  if (!source) throw new Error('Meter case was not found.')
  if (meterCaseWorkload([source], command.asOf)[0]?.priority !== 'urgent') throw new Error('Only an urgent combined case can be escalated.')
  if (command.scheduledOn <= command.asOf) throw new Error('Follow-up must be scheduled after the current business date.')
  if (command.contactEvidence.trim().length < 15 || command.escalationReason.trim().length < 20) throw new Error('Contact evidence and escalation reason are required.')
  const next = structuredClone(state)
  const target = next.cases.find((item) => item.caseId === source.caseId)
  if (!target) throw new Error('Meter case disappeared during the workload update.')
  next.followUps.push({ id: command.id, caseId: source.caseId, previousFieldOwner: source.fieldOwner, previousCustomerOwner: source.customerOwner, owner: command.owner, scheduledOn: command.scheduledOn, contactEvidence: command.contactEvidence.trim(), escalationReason: command.escalationReason.trim(), status: 'scheduled', immutable: true })
  target.fieldOwner = command.owner
  target.customerOwner = command.owner
  target.contactAttempts += 1
  next.revision += 1
  return next
}

interface CloseMeterCase { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: number; reviewedBy: string; closedOn: string }
export function closeMeterCase(state: MeterWorkloadState, command: CloseMeterCase) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new Error('Meter workload changed. Refresh before closure.')
  if (command.role !== 'Operations Supervisor') throw new Error('Only an operations supervisor can independently close a meter case.')
  const source = state.cases.find((item) => item.caseId === command.caseId)
  const followUp = [...state.followUps].reverse().find((item) => item.caseId === command.caseId)
  if (!source || !followUp) throw new Error('Coordinated customer and field follow-up is required before closure.')
  if (!command.customerAcknowledgement || !command.disposalCertificate || !command.billingAdjustmentReference || !command.paymentPlanReference || command.fieldActionsOpen !== 0) throw new Error('Customer, custody, billing, payment, and field evidence must all be complete.')
  const next = structuredClone(state)
  const target = next.cases.find((item) => item.caseId === source.caseId)
  if (!target) throw new Error('Meter case disappeared during closure.')
  next.closures.push({ ...command, fieldActionsOpen: 0, followUpId: followUp.id, immutable: true })
  target.disposalEvidence = 'valid'
  target.paymentCommitment = 'current'
  target.balanceCents = 0
  next.revision += 1
  return next
}

export class MeterWorkloadRepository {
  static key = 'gridloom:meter-workload:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): MeterWorkloadState { const raw = this.storage.getItem(MeterWorkloadRepository.key); return raw ? JSON.parse(raw) as MeterWorkloadState : structuredClone(initialMeterWorkloadState) }
  dispatch(command: CoordinateFollowUp | CloseMeterCase) { const current = this.read(); const next = 'disposalCertificate' in command ? closeMeterCase(current, command) : coordinateMeterFollowUp(current, command); if (next !== current) this.storage.setItem(MeterWorkloadRepository.key, JSON.stringify(next)); return next }
}

export function MeterWorkloadControl() {
  const [repository] = useState(() => new MeterWorkloadRepository(localStorage)); const [state, setState] = useState(() => repository.read()); const [role, setRole] = useState<MeterWorkloadRole>('Operations Viewer'); const [message, setMessage] = useState(''); const feedback = useRef<HTMLParagraphElement>(null); const workload = meterCaseWorkload(state.cases, '2026-10-20')
  const coordinate = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: 'MX-905', owner: 'Revenue recovery', scheduledOn: '2026-10-21', asOf: '2026-10-20', contactEvidence: 'Customer confirmed the missed commitment by telephone.', escalationReason: 'Payment and custody blockers require one accountable recovery owner.' })); setMessage('Customer and field follow-up coordinated under one owner.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Meter follow-up failed.') } queueMicrotask(() => feedback.current?.focus()) }
  const close = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: 'MX-905', customerAcknowledgement: 'ACK-905', disposalCertificate: 'DISPOSAL-905', billingAdjustmentReference: 'BILL-ADJ-905', paymentPlanReference: 'PLAN-905', fieldActionsOpen: 0, reviewedBy: 'Operations assurance', closedOn: '2026-10-22' })); setMessage('Meter case closed after customer and physical-custody reconciliation.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Meter closure failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Meter operations workload"><h2>Customer and field workload</h2><label>Workload role<select value={role} onChange={(event) => { setRole(event.target.value as MeterWorkloadRole) }}><option>Operations Viewer</option><option>Operations Supervisor</option></select></label>{workload.map((item) => <p key={item.caseId}>{item.caseId} · {item.priority} · {item.blockers.join(', ')} · {item.nextAction} · field {item.fieldOwner} · customer {item.customerOwner} · contacts {item.contactAttempts}</p>)}<button disabled={role !== 'Operations Supervisor' || state.followUps.length > 0} onClick={coordinate}>Coordinate urgent meter follow-up</button><button disabled={role !== 'Operations Supervisor' || state.followUps.length === 0 || state.closures.length > 0} onClick={close}>Close reconciled meter case</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Meter follow-up history">{state.followUps.map((item) => <li key={item.id}>{item.caseId} · {item.owner} · scheduled {item.scheduledOn} · {item.status}</li>)}</ol><ol aria-label="Meter closure history">{state.closures.map((item) => <li key={item.id}>{item.caseId} · closed {item.closedOn} · custody {item.disposalCertificate} · customer {item.customerAcknowledgement}</li>)}</ol></section>
}
