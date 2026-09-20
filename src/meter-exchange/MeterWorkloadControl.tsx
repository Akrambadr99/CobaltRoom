/* eslint-disable react-refresh/only-export-components */
import { useRef, useState } from 'react'
import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; immutable: true }
export interface MeterWorkloadState { revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[] }
export const initialMeterWorkloadState: MeterWorkloadState = { revision: 0, cases: structuredClone(seededMeterCases), followUps: [] }
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

export class MeterWorkloadRepository {
  static key = 'gridloom:meter-workload:v1'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  read(): MeterWorkloadState { const raw = this.storage.getItem(MeterWorkloadRepository.key); return raw ? JSON.parse(raw) as MeterWorkloadState : structuredClone(initialMeterWorkloadState) }
  dispatch(command: CoordinateFollowUp) { const current = this.read(); const next = coordinateMeterFollowUp(current, command); if (next !== current) this.storage.setItem(MeterWorkloadRepository.key, JSON.stringify(next)); return next }
}

export function MeterWorkloadControl() {
  const [repository] = useState(() => new MeterWorkloadRepository(localStorage)); const [state, setState] = useState(() => repository.read()); const [role, setRole] = useState<MeterWorkloadRole>('Operations Viewer'); const [message, setMessage] = useState(''); const feedback = useRef<HTMLParagraphElement>(null); const workload = meterCaseWorkload(state.cases, '2026-10-20')
  const coordinate = () => { try { setState(repository.dispatch({ id: crypto.randomUUID(), expectedRevision: state.revision, role, caseId: 'MX-905', owner: 'Revenue recovery', scheduledOn: '2026-10-21', asOf: '2026-10-20', contactEvidence: 'Customer confirmed the missed commitment by telephone.', escalationReason: 'Payment and custody blockers require one accountable recovery owner.' })); setMessage('Customer and field follow-up coordinated under one owner.') } catch (error) { setMessage(error instanceof Error ? error.message : 'Meter follow-up failed.') } queueMicrotask(() => feedback.current?.focus()) }
  return <section className="card" aria-label="Meter operations workload"><h2>Customer and field workload</h2><label>Workload role<select value={role} onChange={(event) => { setRole(event.target.value as MeterWorkloadRole) }}><option>Operations Viewer</option><option>Operations Supervisor</option></select></label>{workload.map((item) => <p key={item.caseId}>{item.caseId} · {item.priority} · {item.blockers.join(', ')} · {item.nextAction} · field {item.fieldOwner} · customer {item.customerOwner} · contacts {item.contactAttempts}</p>)}<button disabled={role !== 'Operations Supervisor' || state.followUps.length > 0} onClick={coordinate}>Coordinate urgent meter follow-up</button>{message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}<ol aria-label="Meter follow-up history">{state.followUps.map((item) => <li key={item.id}>{item.caseId} · {item.owner} · scheduled {item.scheduledOn} · {item.status}</li>)}</ol></section>
}
