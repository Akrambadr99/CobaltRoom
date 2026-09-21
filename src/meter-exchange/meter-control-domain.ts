import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export type MeterCaseErrorCode = 'STALE_REVISION' | 'UNAUTHORIZED' | 'FOLLOW_UP_REQUIRED' | 'EVIDENCE_INCOMPLETE'
export class MeterCaseError extends Error { readonly code: MeterCaseErrorCode; readonly caseId: string; constructor(code: MeterCaseErrorCode, message: string, caseId: string) { super(message); this.code = code; this.caseId = caseId; this.name = 'MeterCaseError' } }
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; immutable: true }
export interface MeterCaseClosure { id: string; caseId: string; followUpId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: 0; reviewedBy: string; closedOn: string; immutable: true }
export interface MeterWorkloadState { revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[]; closures: MeterCaseClosure[] }
export const initialMeterWorkloadState: MeterWorkloadState = { revision: 0, cases: structuredClone(seededMeterCases), followUps: [], closures: [] }
interface CoordinateFollowUp { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; owner: string; scheduledOn: string; asOf: string; contactEvidence: string; escalationReason: string }

export function coordinateMeterFollowUp(state: MeterWorkloadState, command: CoordinateFollowUp) {
  if (state.followUps.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before coordinating follow-up.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can coordinate both owners.', command.caseId)
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
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before closure.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can independently close a meter case.', command.caseId)
  const source = state.cases.find((item) => item.caseId === command.caseId)
  const followUp = [...state.followUps].reverse().find((item) => item.caseId === command.caseId)
  if (!source || !followUp) throw new MeterCaseError('FOLLOW_UP_REQUIRED', 'Coordinated customer and field follow-up is required before closure.', command.caseId)
  if (!command.customerAcknowledgement || !command.disposalCertificate || !command.billingAdjustmentReference || !command.paymentPlanReference || command.fieldActionsOpen !== 0) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Customer, custody, billing, payment, and field evidence must all be complete.', command.caseId)
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

export function queryMeterOperationalHistory(state: MeterWorkloadState, caseId: string) {
  return [
    ...state.followUps.filter((item) => item.caseId === caseId).map((item) => ({ kind: 'owner-coordination' as const, id: item.id, owner: item.owner, evidence: [item.contactEvidence], status: item.status })),
    ...state.closures.filter((item) => item.caseId === caseId).map((item) => ({ kind: 'case-closure' as const, id: item.id, owner: item.reviewedBy, evidence: [item.customerAcknowledgement, item.disposalCertificate, item.billingAdjustmentReference, item.paymentPlanReference], status: 'closed' as const })),
  ]
}

export interface MeterWorkloadPersistence {
  load(): MeterWorkloadState | null
  save(state: MeterWorkloadState): void
}
export class BrowserMeterWorkloadPersistence implements MeterWorkloadPersistence {
  static key = 'gridloom:meter-workload:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserMeterWorkloadPersistence.key); return raw ? JSON.parse(raw) as MeterWorkloadState : null }
  save(state: MeterWorkloadState) { this.storage.setItem(BrowserMeterWorkloadPersistence.key, JSON.stringify(state)) }
}
export class MeterWorkloadRepository {
  private readonly persistence: MeterWorkloadPersistence
  constructor(persistence: MeterWorkloadPersistence) { this.persistence = persistence }
  read(): MeterWorkloadState { return this.persistence.load() ?? structuredClone(initialMeterWorkloadState) }
  dispatch(command: CoordinateFollowUp | CloseMeterCase) { const current = this.read(); const next = 'disposalCertificate' in command ? closeMeterCase(current, command) : coordinateMeterFollowUp(current, command); if (next !== current) this.persistence.save(next); return next }
}
