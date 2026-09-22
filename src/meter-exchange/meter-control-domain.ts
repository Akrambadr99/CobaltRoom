import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export type MeterCaseErrorCode = 'STALE_REVISION' | 'UNAUTHORIZED' | 'FOLLOW_UP_REQUIRED' | 'EVIDENCE_INCOMPLETE'
export class MeterCaseError extends Error { readonly code: MeterCaseErrorCode; readonly caseId: string; constructor(code: MeterCaseErrorCode, message: string, caseId: string) { super(message); this.code = code; this.caseId = caseId; this.name = 'MeterCaseError' } }
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; immutable: true }
export interface MeterCaseClosure { id: string; caseId: string; followUpId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: 0; reviewedBy: string; closedOn: string; immutable: true }
export type MeterOperationalEventKind = 'customer-contact' | 'responsibility-transfer' | 'custody-confirmation' | 'closure-verification'
export interface MeterOperationalEvent { id: string; caseId: string; kind: MeterOperationalEventKind; stream: 'customer' | 'field-custody'; actor: string; occurredOn: string; sourceRevision: number; evidenceReference: string; meaning: string; immutable: true }
export type MeterDisposalStage = 'requested' | 'authorized' | 'handed-off' | 'received' | 'evidence-rejected' | 'evidence-corrected' | 'confirmed'
export interface MeterDisposalContractor { id: string; organizationName: string; authorizationStatus: 'authorized' | 'suspended'; permittedOperations: ('meter-disposal' | 'custody-transport')[]; active: boolean; operationalReference: string; effectiveFrom: string; certificationExpiresOn: string }
export interface ContractorAuthorizationEvent { id: string; contractorId: string; active: boolean; certificationExpiresOn: string; actor: string; reason: string; changedOn: string; sourceRevision: number; immutable: true }
export interface PlannedCustodyHandoff { id: string; caseId: string; contractorId: string; scheduledOn: string; plannedBy: string; sourceRevision: number; previousHandoffId?: string; reassignmentReason?: string; immutable: true }
export interface CustodyEligibilityNotice { id: string; handoffId: string; contractorId: string; certificationExpiresOn: string; issuedOn: string; immutable: true }
export interface CustodyNoticeAcknowledgement { id: string; noticeId: string; actor: string; acknowledgedOn: string; immutable: true }
export interface CustodyRemediationDeferral { id: string; caseId: string; affectedHandoffId: string; certificationEventId: string; owner: string; reason: string; reviewOn: string; deferredOn: string; immutable: true }
export const meterDisposalContractors: MeterDisposalContractor[] = [{ id: 'CONTRACTOR-CMS', organizationName: 'Circular Meter Services', authorizationStatus: 'authorized', permittedOperations: ['meter-disposal', 'custody-transport'], active: true, operationalReference: 'WASTE-LICENCE-881', effectiveFrom: '2026-01-01', certificationExpiresOn: '2026-11-30' }, { id: 'CONTRACTOR-OLD', organizationName: 'Legacy Meter Recycling', authorizationStatus: 'suspended', permittedOperations: ['meter-disposal'], active: false, operationalReference: 'WASTE-LICENCE-114', effectiveFrom: '2024-01-01', certificationExpiresOn: '2025-12-31' }, { id: 'CONTRACTOR-ARC', organizationName: 'Arc Reclamation', authorizationStatus: 'authorized', permittedOperations: ['meter-disposal', 'custody-transport'], active: true, operationalReference: 'WASTE-LICENCE-925', effectiveFrom: '2026-04-01', certificationExpiresOn: '2027-12-31' }]
export interface MeterDisposalEvent { id: string; caseId: string; stage: MeterDisposalStage; contractor: string; contractorId?: string; contractorOperationalReference?: string; custodyReference: string; evidenceReference: string; reason: string | null; actor: string; occurredOn: string; sourceRevision: number; immutable: true }
export interface MeterWorkloadState { revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[]; operationalEvents: MeterOperationalEvent[]; disposalEvents: MeterDisposalEvent[]; contractors: MeterDisposalContractor[]; contractorHistory: ContractorAuthorizationEvent[]; plannedHandoffs: PlannedCustodyHandoff[]; remediationDeferrals: CustodyRemediationDeferral[]; eligibilityNotices: CustodyEligibilityNotice[]; noticeAcknowledgements: CustodyNoticeAcknowledgement[]; closures: MeterCaseClosure[] }
export const initialMeterWorkloadState: MeterWorkloadState = { revision: 0, cases: structuredClone(seededMeterCases), followUps: [], operationalEvents: [], disposalEvents: [], contractors: structuredClone(meterDisposalContractors), contractorHistory: [], plannedHandoffs: [], remediationDeferrals: [], eligibilityNotices: [], noticeAcknowledgements: [], closures: [] }
export function contractorEligibility(contractor: MeterDisposalContractor, on: string) { return { eligible: contractor.active && contractor.authorizationStatus === 'authorized' && contractor.effectiveFrom <= on && contractor.certificationExpiresOn >= on && contractor.permittedOperations.includes('meter-disposal'), expiresOn: contractor.certificationExpiresOn, expiringSoon: contractor.certificationExpiresOn >= on && (Date.parse(contractor.certificationExpiresOn) - Date.parse(on)) / 86_400_000 <= 30 } }
export function plannedCustodyReadiness(state: MeterWorkloadState, caseId: string) { const plan = [...state.plannedHandoffs].reverse().find((item) => item.caseId === caseId); if (!plan) return null; const contractor = state.contractors.find((item) => item.id === plan.contractorId); const notice = state.eligibilityNotices.find((item) => item.handoffId === plan.id); const acknowledgement = state.noticeAcknowledgements.find((item) => item.noticeId === notice?.id); return { plan, contractor, notice, acknowledgement, ready: Boolean(contractor && contractorEligibility(contractor, plan.scheduledOn).eligible), reassignmentRequired: !contractor || !contractorEligibility(contractor, plan.scheduledOn).eligible } }
export function contractorCertificationImpact(state: MeterWorkloadState, contractorId: string, asOf: string) {
  const events = state.contractorHistory.filter((item) => item.contractorId === contractorId)
  const effective = events.filter((item) => item.changedOn <= asOf).at(-1)
  const base = meterDisposalContractors.find((item) => item.id === contractorId)
  const current = state.contractors.find((item) => item.id === contractorId)
  const contractor = events.length && !effective ? base : current
  const certified = contractor && effective ? { ...contractor, active: effective.active, authorizationStatus: effective.active ? 'authorized' as const : 'suspended' as const, certificationExpiresOn: effective.certificationExpiresOn } : contractor
  return state.plannedHandoffs.filter((plan) => plan.contractorId === contractorId && plan.scheduledOn >= asOf && !state.disposalEvents.some((event) => event.caseId === plan.caseId && event.stage === 'handed-off')).filter((plan, index, plans) => plans.findIndex((item) => item.caseId === plan.caseId) === index).map((original) => {
    const currentPlan = state.plannedHandoffs.filter((plan) => plan.caseId === original.caseId).at(-1) ?? original
    const eligible = Boolean(certified && contractorEligibility(certified, original.scheduledOn).eligible)
    const owner = state.followUps.filter((item) => item.caseId === original.caseId).at(-1)?.owner ?? state.cases.find((item) => item.caseId === original.caseId)?.fieldOwner ?? 'unassigned'
    return { caseId: original.caseId, owner, originalPlanId: original.id, currentPlanId: currentPlan.id, scheduledOn: currentPlan.scheduledOn, contractorId, certificationRevision: effective?.sourceRevision ?? null, certificationEventId: effective?.id ?? null, replacementContractorId: currentPlan.contractorId === contractorId ? null : currentPlan.contractorId, status: currentPlan.contractorId !== contractorId ? 'reassigned' as const : eligible ? 'eligible' as const : 'blocked' as const, reason: currentPlan.contractorId !== contractorId ? 'Replacement custody plan recorded' : !certified ? 'Contractor source missing' : !certified.active ? 'Contractor authorization suspended' : `Certification does not cover ${original.scheduledOn}` }
  })
}
export function custodyRemediationProgress(state: MeterWorkloadState, contractorId: string, asOf: string) {
  const cases = contractorCertificationImpact(state, contractorId, asOf).map((impact) => {
    const deferral = state.remediationDeferrals.filter((item) => item.caseId === impact.caseId && item.affectedHandoffId === impact.originalPlanId && item.certificationEventId === impact.certificationEventId).at(-1) ?? null
    const outcome = impact.status === 'reassigned' ? 'reassigned' as const : impact.status === 'blocked' && deferral ? 'deferred' as const : impact.status === 'blocked' ? 'unresolved' as const : 'eligible' as const
    return { ...impact, deferral, outcome, candidates: state.contractors.filter((item) => item.id !== impact.contractorId && contractorEligibility(item, impact.scheduledOn).eligible).map((item) => item.id) }
  })
  return { cases, total: cases.length, reassigned: cases.filter((item) => item.outcome === 'reassigned').length, deferred: cases.filter((item) => item.outcome === 'deferred').length, unresolved: cases.filter((item) => item.outcome === 'unresolved').length }
}

export function deferCustodyRemediation(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; affectedHandoffId: string; certificationEventId: string; owner: string; reason: string; reviewOn: string; deferredOn: string }) {
  if (state.remediationDeferrals.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Custody impact changed. Refresh before deferring this case.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can defer a blocked custody plan.', command.caseId)
  const impact = contractorCertificationImpact(state, state.plannedHandoffs.find((item) => item.id === command.affectedHandoffId)?.contractorId ?? '', command.deferredOn).find((item) => item.caseId === command.caseId)
  if (impact?.status !== 'blocked' || impact.originalPlanId !== command.affectedHandoffId || impact.certificationEventId !== command.certificationEventId) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Only the current blocked custody impact can be deferred.', command.caseId)
  if (!command.owner.trim() || command.reason.trim().length < 15 || command.reviewOn <= command.deferredOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Owner, specific reason, and future review date are required.', command.caseId)
  const next = structuredClone(state)
  next.remediationDeferrals.push({ id: command.id, caseId: command.caseId, affectedHandoffId: command.affectedHandoffId, certificationEventId: command.certificationEventId, owner: command.owner.trim(), reason: command.reason.trim(), reviewOn: command.reviewOn, deferredOn: command.deferredOn, immutable: true })
  next.revision += 1
  return next
}
export function planMeterCustodyHandoff(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; contractorId: string; scheduledOn: string; plannedBy: string; plannedOn: string }) {
  if (state.plannedHandoffs.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before planning custody.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can plan contractor custody.', command.caseId)
  const meterCase = state.cases.find((item) => item.caseId === command.caseId)
  if (!meterCase || meterCase.disposalEvidence === 'valid' || !state.contractors.some((item) => item.id === command.contractorId) || meterCaseWorkload([meterCase], command.plannedOn)[0]?.priority === 'urgent' && !state.followUps.some((item) => item.caseId === command.caseId)) throw new MeterCaseError('FOLLOW_UP_REQUIRED', 'An unresolved custody case, known contractor, and coordinated urgent owner are required.', command.caseId)
  if (!command.plannedBy.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(command.scheduledOn) || command.scheduledOn < command.plannedOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'A planner and future business date are required.', command.caseId)
  if (state.disposalEvents.some((item) => item.caseId === command.caseId && item.stage === 'handed-off')) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Historical custody cannot be replanned after handoff.', command.caseId)
  if (state.plannedHandoffs.some((item) => item.caseId === command.caseId)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'A planned handoff must be reassigned with attributed history.', command.caseId)
  const next = structuredClone(state)
  next.plannedHandoffs.push({ id: command.id, caseId: command.caseId, contractorId: command.contractorId, scheduledOn: command.scheduledOn, plannedBy: command.plannedBy.trim(), sourceRevision: state.revision, immutable: true })
  const contractor = state.contractors.find((item) => item.id === command.contractorId)
  if (!contractor) throw new Error('Planned contractor disappeared during custody update.')
  if (!contractorEligibility(contractor, command.scheduledOn).eligible || contractorEligibility(contractor, command.plannedOn).expiringSoon) next.eligibilityNotices.push({ id: `${command.id}:notice`, handoffId: command.id, contractorId: contractor.id, certificationExpiresOn: contractor.certificationExpiresOn, issuedOn: command.plannedOn, immutable: true })
  next.revision += 1
  return next
}
export function reassignPlannedCustodyHandoff(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; contractorId: string; scheduledOn: string; reassignedBy: string; reassignedOn: string; reason: string }) {
  if (state.plannedHandoffs.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Planned custody changed. Refresh before reassignment.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can reassign planned custody.', command.caseId)
  const previous = plannedCustodyReadiness(state, command.caseId)
  if (!previous || !previous.reassignmentRequired || state.disposalEvents.some((item) => item.caseId === command.caseId && item.stage === 'handed-off')) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Only an unexecuted ineligible handoff can be reassigned.', command.caseId)
  const replacement = state.contractors.find((item) => item.id === command.contractorId)
  if (!replacement || replacement.id === previous.plan.contractorId || !contractorEligibility(replacement, command.scheduledOn).eligible || command.scheduledOn < command.reassignedOn || !command.reassignedBy.trim() || command.reason.trim().length < 15) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'A different eligible contractor, future date, operator, and reason are required.', command.caseId)
  const next = structuredClone(state)
  next.plannedHandoffs.push({ id: command.id, caseId: command.caseId, contractorId: replacement.id, scheduledOn: command.scheduledOn, plannedBy: command.reassignedBy.trim(), sourceRevision: state.revision, previousHandoffId: previous.plan.id, reassignmentReason: command.reason.trim(), immutable: true })
  next.revision += 1
  return next
}
export function acknowledgeCustodyEligibilityNotice(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; noticeId: string; actor: string; acknowledgedOn: string }) {
  const notice = state.eligibilityNotices.find((item) => item.id === command.noticeId)
  if (state.noticeAcknowledgements.some((item) => item.id === command.id || item.noticeId === command.noticeId)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Eligibility notice changed. Refresh before acknowledgement.', command.noticeId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can acknowledge contractor risk.', command.noticeId)
  if (!notice || !command.actor.trim() || command.acknowledgedOn < notice.issuedOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Current notice, actor, and business date are required.', command.noticeId)
  const next = structuredClone(state)
  next.noticeAcknowledgements.push({ id: command.id, noticeId: command.noticeId, actor: command.actor.trim(), acknowledgedOn: command.acknowledgedOn, immutable: true })
  next.revision += 1
  return next
}
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
  const planned = plannedCustodyReadiness(state, command.caseId)
  if (command.stage === 'handed-off' && planned && (planned.plan.contractorId !== contractor?.id || planned.plan.scheduledOn !== command.occurredOn.slice(0, 10))) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Custody handoff must match the current planned contractor and date.', command.caseId)
  if (command.stage === 'handed-off' && (!contractor || !contractorEligibility(contractor, command.occurredOn.slice(0, 10)).eligible)) throw new MeterCaseError('UNAUTHORIZED', 'Custody can only be handed to an active contractor authorized and certified for meter disposal.', command.caseId)
  if (history.length > 0 && history.at(-1)?.contractor !== (contractor?.organizationName ?? command.contractor)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Disposal contractor cannot change within the custody chain.', command.caseId)
  const next = structuredClone(state)
  next.disposalEvents.push({ ...command, contractor: contractor?.organizationName ?? command.contractor, ...(contractor ? { contractorId: contractor.id, contractorOperationalReference: contractor.operationalReference } : {}), reason: command.reason?.trim() ?? null, sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}

export function setDisposalContractorActive(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; contractorId: string; active: boolean; certificationExpiresOn: string; actor: string; reason: string; changedOn: string }) {
  if (state.contractorHistory.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Contractor directory changed. Refresh before updating eligibility.', command.contractorId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can change contractor eligibility.', command.contractorId)
  const contractor = state.contractors.find((item) => item.id === command.contractorId)
  if (!contractor) throw new Error('Disposal contractor was not found.')
  if (!command.actor.trim() || command.reason.trim().length < 15 || !Number.isFinite(Date.parse(command.changedOn)) || command.certificationExpiresOn < command.changedOn.slice(0, 10)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Attribution, reason, business date, and current certification are required.', command.contractorId)
  if (contractor.active === command.active && contractor.certificationExpiresOn === command.certificationExpiresOn) return state
  const next = structuredClone(state)
  const updated = next.contractors.find((item) => item.id === command.contractorId)
  if (!updated) throw new Error('Disposal contractor disappeared during eligibility update.')
  updated.active = command.active
  updated.certificationExpiresOn = command.certificationExpiresOn
  next.contractorHistory.push({ id: command.id, contractorId: command.contractorId, active: command.active, certificationExpiresOn: command.certificationExpiresOn, actor: command.actor.trim(), reason: command.reason.trim(), changedOn: command.changedOn, sourceRevision: state.revision, immutable: true })
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
  load() { const raw = this.storage.getItem(BrowserMeterWorkloadPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Omit<Partial<MeterWorkloadState>, 'contractors'> & { contractors?: (Omit<MeterDisposalContractor, 'certificationExpiresOn'> & { certificationExpiresOn?: string })[] }; return { ...(saved as MeterWorkloadState), operationalEvents: saved.operationalEvents ?? [], disposalEvents: saved.disposalEvents ?? [], contractors: (saved.contractors ?? structuredClone(meterDisposalContractors)).map((item) => ({ ...item, certificationExpiresOn: item.certificationExpiresOn ?? '2026-11-30' })), contractorHistory: saved.contractorHistory ?? [], plannedHandoffs: saved.plannedHandoffs ?? [], remediationDeferrals: saved.remediationDeferrals ?? [], eligibilityNotices: saved.eligibilityNotices ?? [], noticeAcknowledgements: saved.noticeAcknowledgements ?? [] } }
  save(state: MeterWorkloadState) { this.storage.setItem(BrowserMeterWorkloadPersistence.key, JSON.stringify(state)) }
}
export class MeterWorkloadRepository {
  private readonly persistence: MeterWorkloadPersistence
  constructor(persistence: MeterWorkloadPersistence) { this.persistence = persistence }
  read(): MeterWorkloadState { return this.persistence.load() ?? structuredClone(initialMeterWorkloadState) }
  dispatch(command: CoordinateFollowUp | RecordMeterDisposalStage | CloseMeterCase | Parameters<typeof setDisposalContractorActive>[1] | Parameters<typeof planMeterCustodyHandoff>[1] | Parameters<typeof reassignPlannedCustodyHandoff>[1] | Parameters<typeof deferCustodyRemediation>[1] | Parameters<typeof acknowledgeCustodyEligibilityNotice>[1]) { const current = this.read(); const next = 'noticeId' in command ? acknowledgeCustodyEligibilityNotice(current, command) : 'affectedHandoffId' in command ? deferCustodyRemediation(current, command) : 'reassignedBy' in command ? reassignPlannedCustodyHandoff(current, command) : 'scheduledOn' in command && 'contractorId' in command ? planMeterCustodyHandoff(current, command) : 'contractorId' in command && 'active' in command ? setDisposalContractorActive(current, command) : 'disposalCertificate' in command ? closeMeterCase(current, command) : 'stage' in command ? recordMeterDisposalStage(current, command) : coordinateMeterFollowUp(current, command); if (next !== current) this.persistence.save(next); return next }
}
