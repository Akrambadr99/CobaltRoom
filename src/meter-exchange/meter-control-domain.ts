import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export type MeterCaseErrorCode = 'STALE_REVISION' | 'UNAUTHORIZED' | 'FOLLOW_UP_REQUIRED' | 'EVIDENCE_INCOMPLETE'
export class MeterCaseError extends Error { readonly code: MeterCaseErrorCode; readonly caseId: string; constructor(code: MeterCaseErrorCode, message: string, caseId: string) { super(message); this.code = code; this.caseId = caseId; this.name = 'MeterCaseError' } }
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; immutable: true }
export interface MeterCaseClosure { id: string; caseId: string; followUpId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: 0; reviewedBy: string; closedOn: string; immutable: true }
export type MeterOperationalEventKind = 'customer-contact' | 'responsibility-transfer' | 'custody-confirmation' | 'closure-verification'
export interface MeterOperationalEvent { id: string; caseId: string; kind: MeterOperationalEventKind; stream: 'customer' | 'field-custody'; actor: string; occurredOn: string; sourceRevision: number; evidenceReference: string; meaning: string; immutable: true }
export type MeterDisposalStage = 'requested' | 'authorized' | 'handed-off' | 'received' | 'evidence-rejected' | 'evidence-corrected' | 'confirmed'
export interface MeterDisposalContractor { id: string; organizationName: string; authorizationStatus: 'authorized' | 'suspended'; permittedOperations: ('meter-disposal' | 'custody-transport')[]; active: boolean; operationalReference: string; effectiveFrom: string }
export const meterDisposalContractors: MeterDisposalContractor[] = [{ id: 'CONTRACTOR-CMS', organizationName: 'Circular Meter Services', authorizationStatus: 'authorized', permittedOperations: ['meter-disposal', 'custody-transport'], active: true, operationalReference: 'WASTE-LICENCE-881', effectiveFrom: '2026-01-01' }, { id: 'CONTRACTOR-OLD', organizationName: 'Legacy Meter Recycling', authorizationStatus: 'suspended', permittedOperations: ['meter-disposal'], active: false, operationalReference: 'WASTE-LICENCE-114', effectiveFrom: '2024-01-01' }]
export interface MeterDisposalEvent { id: string; caseId: string; stage: MeterDisposalStage; contractor: string; contractorId?: string; contractorOperationalReference?: string; custodyReference: string; evidenceReference: string; reason: string | null; actor: string; occurredOn: string; sourceRevision: number; immutable: true }
export interface MeterWorkloadState { revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[]; operationalEvents: MeterOperationalEvent[]; disposalEvents: MeterDisposalEvent[]; contractors: MeterDisposalContractor[]; closures: MeterCaseClosure[] }
export const initialMeterWorkloadState: MeterWorkloadState = { revision: 0, cases: structuredClone(seededMeterCases), followUps: [], operationalEvents: [], disposalEvents: [], contractors: structuredClone(meterDisposalContractors), closures: [] }
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
  next.operationalEvents.push(
    { id: `${command.id}:contact`, caseId: source.caseId, kind: 'customer-contact', stream: 'customer', actor: command.owner, occurredOn: command.asOf, sourceRevision: state.revision, evidenceReference: command.contactEvidence.trim(), meaning: 'Customer obligation confirmed for coordinated recovery.', immutable: true },
    { id: `${command.id}:transfer`, caseId: source.caseId, kind: 'responsibility-transfer', stream: 'field-custody', actor: command.owner, occurredOn: command.asOf, sourceRevision: state.revision, evidenceReference: command.escalationReason.trim(), meaning: `Field and customer responsibility transferred from ${source.fieldOwner} / ${source.customerOwner}.`, immutable: true },
  )
  target.fieldOwner = command.owner
  target.customerOwner = command.owner
  target.contactAttempts += 1
  next.revision += 1
  return next
}

interface RecordMeterDisposalStage { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; stage: MeterDisposalStage; contractor: string; contractorId?: string; custodyReference: string; evidenceReference: string; reason: string | null; actor: string; occurredOn: string }
export function recordMeterDisposalStage(state: MeterWorkloadState, command: RecordMeterDisposalStage) {
  if (state.disposalEvents.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before recording disposal custody.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can authorize disposal custody changes.', command.caseId)
  if (!state.followUps.some((item) => item.caseId === command.caseId)) throw new MeterCaseError('FOLLOW_UP_REQUIRED', 'Coordinated follow-up is required before disposal handoff.', command.caseId)
  const history = state.disposalEvents.filter((item) => item.caseId === command.caseId)
  const previous = history.at(-1)?.stage
  const allowed: Record<MeterDisposalStage, MeterDisposalStage[]> = { requested: [], authorized: ['requested'], 'handed-off': ['authorized'], received: ['handed-off'], 'evidence-rejected': ['received'], 'evidence-corrected': ['evidence-rejected'], confirmed: ['received', 'evidence-corrected'] }
  if ((command.stage === 'requested' && history.length > 0) || (command.stage !== 'requested' && (!previous || !allowed[command.stage].includes(previous)))) throw new Error(`Disposal stage ${command.stage} cannot follow ${previous ?? 'no custody record'}.`)
  if (!command.contractor || !command.custodyReference || !command.evidenceReference || (command.stage === 'evidence-rejected' && !command.reason?.trim())) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Contractor, custody, stage evidence, and rejection reasons must be retained.', command.caseId)
  const contractor = state.contractors.find((item) => item.id === command.contractorId || item.organizationName === command.contractor)
  if (command.stage === 'handed-off' && (!contractor?.active || contractor.authorizationStatus !== 'authorized' || !contractor.permittedOperations.includes('meter-disposal'))) throw new MeterCaseError('UNAUTHORIZED', 'Custody can only be handed to an active contractor authorized for meter disposal.', command.caseId)
  if (history.length > 0 && history.at(-1)?.contractor !== (contractor?.organizationName ?? command.contractor)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Disposal contractor cannot change within the custody chain.', command.caseId)
  const next = structuredClone(state)
  next.disposalEvents.push({ ...command, contractor: contractor?.organizationName ?? command.contractor, ...(contractor ? { contractorId: contractor.id, contractorOperationalReference: contractor.operationalReference } : {}), reason: command.reason?.trim() ?? null, sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function setDisposalContractorActive(state: MeterWorkloadState, command: { expectedRevision: number; role: MeterWorkloadRole; contractorId: string; active: boolean }) {
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Contractor directory changed. Refresh before updating eligibility.', command.contractorId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can change contractor eligibility.', command.contractorId)
  const contractor = state.contractors.find((item) => item.id === command.contractorId)
  if (!contractor) throw new Error('Disposal contractor was not found.')
  if (contractor.active === command.active) return state
  const next = structuredClone(state)
  const updated = next.contractors.find((item) => item.id === command.contractorId)
  if (!updated) throw new Error('Disposal contractor disappeared during eligibility update.')
  updated.active = command.active
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
  const disposalHistory = state.disposalEvents.filter((item) => item.caseId === command.caseId)
  if (disposalHistory.length > 0 && disposalHistory.at(-1)?.stage !== 'confirmed') throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Confirmed contractor disposal evidence is required before custody closure.', command.caseId)
  if (!command.customerAcknowledgement || !command.disposalCertificate || !command.billingAdjustmentReference || !command.paymentPlanReference || command.fieldActionsOpen !== 0) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Customer, custody, billing, payment, and field evidence must all be complete.', command.caseId)
  const next = structuredClone(state)
  const target = next.cases.find((item) => item.caseId === source.caseId)
  if (!target) throw new Error('Meter case disappeared during closure.')
  next.closures.push({ ...command, fieldActionsOpen: 0, followUpId: followUp.id, immutable: true })
  next.operationalEvents.push(
    { id: `${command.id}:custody`, caseId: source.caseId, kind: 'custody-confirmation', stream: 'field-custody', actor: command.reviewedBy, occurredOn: command.closedOn, sourceRevision: state.revision, evidenceReference: command.disposalCertificate, meaning: 'Removed meter custody and disposal were independently confirmed.', immutable: true },
    { id: `${command.id}:verification`, caseId: source.caseId, kind: 'closure-verification', stream: 'customer', actor: command.reviewedBy, occurredOn: command.closedOn, sourceRevision: state.revision, evidenceReference: command.customerAcknowledgement, meaning: 'Customer, billing, and payment obligations were verified for closure.', immutable: true },
  )
  target.disposalEvidence = 'valid'
  target.paymentCommitment = 'current'
  target.balanceCents = 0
  next.revision += 1
  return next
}

export function queryMeterOperationalHistory(state: MeterWorkloadState, caseId: string) {
  const events = state.operationalEvents.filter((item) => item.caseId === caseId)
  return { customer: events.filter((item) => item.stream === 'customer'), fieldCustody: events.filter((item) => item.stream === 'field-custody'), combined: events.sort((a, b) => a.occurredOn.localeCompare(b.occurredOn)) }
}

export interface MeterWorkloadPersistence {
  load(): MeterWorkloadState | null
  save(state: MeterWorkloadState): void
}
export class BrowserMeterWorkloadPersistence implements MeterWorkloadPersistence {
  static key = 'gridloom:meter-workload:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserMeterWorkloadPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Partial<MeterWorkloadState>; return { ...(saved as MeterWorkloadState), operationalEvents: saved.operationalEvents ?? [], disposalEvents: saved.disposalEvents ?? [], contractors: saved.contractors ?? structuredClone(meterDisposalContractors) } }
  save(state: MeterWorkloadState) { this.storage.setItem(BrowserMeterWorkloadPersistence.key, JSON.stringify(state)) }
}
export class MeterWorkloadRepository {
  private readonly persistence: MeterWorkloadPersistence
  constructor(persistence: MeterWorkloadPersistence) { this.persistence = persistence }
  read(): MeterWorkloadState { return this.persistence.load() ?? structuredClone(initialMeterWorkloadState) }
  dispatch(command: CoordinateFollowUp | RecordMeterDisposalStage | CloseMeterCase | Parameters<typeof setDisposalContractorActive>[1]) { const current = this.read(); const next = 'contractorId' in command && 'active' in command ? setDisposalContractorActive(current, command) : 'disposalCertificate' in command ? closeMeterCase(current, command) : 'stage' in command ? recordMeterDisposalStage(current, command) : coordinateMeterFollowUp(current, command); if (next !== current) this.persistence.save(next); return next }
}
