import { meterOperators, requireMeterOperator, type MeterOperator } from './meter-operators'
import { meterCaseWorkload, seededMeterCases, type MeterOperationalCase } from './meter-case-workload'

export type MeterWorkloadRole = 'Operations Viewer' | 'Operations Supervisor'
export type MeterCaseErrorCode = 'STALE_REVISION' | 'UNAUTHORIZED' | 'FOLLOW_UP_REQUIRED' | 'EVIDENCE_INCOMPLETE'
export class MeterCaseError extends Error { readonly code: MeterCaseErrorCode; readonly caseId: string; constructor(code: MeterCaseErrorCode, message: string, caseId: string) { super(message); this.code = code; this.caseId = caseId; this.name = 'MeterCaseError' } }
export interface MeterFollowUp { id: string; caseId: string; previousFieldOwner: string; previousCustomerOwner: string; owner: string; scheduledOn: string; contactEvidence: string; escalationReason: string; status: 'scheduled'; scope?: 'field custody'; immutable: true }
export interface MeterCaseClosure { operatorId?: string; id: string; caseId: string; followUpId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: 0; reviewedBy: string; closedOn: string; immutable: true }
export type MeterOperationalEventKind = 'customer-contact' | 'responsibility-transfer' | 'custody-confirmation' | 'closure-verification' | 'recovery-restoration'
export interface MeterOperationalEvent { id: string; caseId: string; kind: MeterOperationalEventKind; stream: 'customer' | 'field-custody'; actor: string; occurredOn: string; sourceRevision: number; evidenceReference: string; meaning: string; immutable: true }
export type MeterDisposalStage = 'requested' | 'authorized' | 'handed-off' | 'received' | 'evidence-rejected' | 'evidence-corrected' | 'confirmed'
export interface MeterDisposalContractor { id: string; organizationName: string; authorizationStatus: 'authorized' | 'suspended'; permittedOperations: ('meter-disposal' | 'custody-transport')[]; active: boolean; operationalReference: string; effectiveFrom: string; certificationExpiresOn: string }
export interface ContractorAuthorizationEvent { id: string; contractorId: string; active: boolean; certificationExpiresOn: string; actor: string; reason: string; changedOn: string; sourceRevision: number; immutable: true }
export interface PlannedCustodyHandoff { id: string; caseId: string; contractorId: string; scheduledOn: string; plannedBy: string; sourceRevision: number; previousHandoffId?: string; reassignmentReason?: string; immutable: true }
export interface CustodyEligibilityNotice { id: string; handoffId: string; contractorId: string; certificationExpiresOn: string; issuedOn: string; immutable: true }
export interface CustodyNoticeAcknowledgement { id: string; noticeId: string; actor: string; acknowledgedOn: string; immutable: true }
export interface CustodyDeferralReview { id: string; deferralId: string; caseId: string; decision: 'continue' | 'reassign'; reviewedBy: string; reviewedOn: string; evidenceReference: string; nextReviewOn: string | null; replacementPlanId: string | null; immutable: true }
export interface CustodyRemediationDeferral { id: string; caseId: string; affectedHandoffId: string; certificationEventId: string; owner: string; reason: string; reviewOn: string; deferredOn: string; immutable: true }
export const meterDisposalContractors: MeterDisposalContractor[] = [{ id: 'CONTRACTOR-CMS', organizationName: 'Circular Meter Services', authorizationStatus: 'authorized', permittedOperations: ['meter-disposal', 'custody-transport'], active: true, operationalReference: 'WASTE-LICENCE-881', effectiveFrom: '2026-01-01', certificationExpiresOn: '2026-11-30' }, { id: 'CONTRACTOR-OLD', organizationName: 'Legacy Meter Recycling', authorizationStatus: 'suspended', permittedOperations: ['meter-disposal'], active: false, operationalReference: 'WASTE-LICENCE-114', effectiveFrom: '2024-01-01', certificationExpiresOn: '2025-12-31' }, { id: 'CONTRACTOR-ARC', organizationName: 'Arc Reclamation', authorizationStatus: 'authorized', permittedOperations: ['meter-disposal', 'custody-transport'], active: true, operationalReference: 'WASTE-LICENCE-925', effectiveFrom: '2026-04-01', certificationExpiresOn: '2027-12-31' }]
export interface MeterDisposalEvent { operatorId?: string; certificateReference?: string; reviewedEvidenceEventId?: string; id: string; caseId: string; stage: MeterDisposalStage; contractor: string; contractorId?: string; contractorOperationalReference?: string; custodyReference: string; evidenceReference: string; reason: string | null; actor: string; occurredOn: string; sourceRevision: number; immutable: true }
export interface CustodyAuthorizationAmendment { id: string; caseId: string; planId: string; authorizationEventId: string; previousContractorId: string; replacementContractorId: string; custodyReference: string; reason: string; approvalEvidence: string; approvedBy: string; approvedOn: string; immutable: true }
export interface MeterWorkloadState { operators?: MeterOperator[]; revision: number; cases: MeterOperationalCase[]; followUps: MeterFollowUp[]; operationalEvents: MeterOperationalEvent[]; disposalEvents: MeterDisposalEvent[]; custodyAmendments: CustodyAuthorizationAmendment[]; contractors: MeterDisposalContractor[]; contractorHistory: ContractorAuthorizationEvent[]; plannedHandoffs: PlannedCustodyHandoff[]; remediationDeferrals: CustodyRemediationDeferral[]; deferralReviews: CustodyDeferralReview[]; eligibilityNotices: CustodyEligibilityNotice[]; noticeAcknowledgements: CustodyNoticeAcknowledgement[]; closures: MeterCaseClosure[] }
export const initialMeterWorkloadState: MeterWorkloadState = { operators: structuredClone(meterOperators), revision: 0, cases: structuredClone(seededMeterCases), followUps: [], operationalEvents: [], disposalEvents: [], custodyAmendments: [], contractors: structuredClone(meterDisposalContractors), contractorHistory: [], plannedHandoffs: [], remediationDeferrals: [], deferralReviews: [], eligibilityNotices: [], noticeAcknowledgements: [], closures: [] }
export function contractorEligibility(contractor: MeterDisposalContractor, on: string) { return { eligible: contractor.active && contractor.authorizationStatus === 'authorized' && contractor.effectiveFrom <= on && contractor.certificationExpiresOn >= on && contractor.permittedOperations.includes('meter-disposal'), expiresOn: contractor.certificationExpiresOn, expiringSoon: contractor.certificationExpiresOn >= on && (Date.parse(contractor.certificationExpiresOn) - Date.parse(on)) / 86_400_000 <= 30 } }
export function plannedCustodyReadiness(state: MeterWorkloadState, caseId: string) { const plan = [...state.plannedHandoffs].reverse().find((item) => item.caseId === caseId); if (!plan) return null; const contractor = state.contractors.find((item) => item.id === plan.contractorId); const notice = state.eligibilityNotices.find((item) => item.handoffId === plan.id); const acknowledgement = state.noticeAcknowledgements.find((item) => item.noticeId === notice?.id); return { plan, contractor, notice, acknowledgement, ready: Boolean(contractor && contractorEligibility(contractor, plan.scheduledOn).eligible), reassignmentRequired: !contractor || !contractorEligibility(contractor, plan.scheduledOn).eligible } }
export function contractorCertificationImpact(state: MeterWorkloadState, contractorId: string, asOf: string) {
  const events = state.contractorHistory.filter((item) => item.contractorId === contractorId)
  const effective = events.filter((item) => item.changedOn <= asOf).at(-1)
  const base = meterDisposalContractors.find((item) => item.id === contractorId)
  const current = state.contractors.find((item) => item.id === contractorId)
  const contractor = events.length && !effective ? base : current
  const certified = contractor && effective ? { ...contractor, active: effective.active, authorizationStatus: effective.active ? 'authorized' as const : 'suspended' as const, certificationExpiresOn: effective.certificationExpiresOn } : contractor
  return state.plannedHandoffs.filter((plan) => plan.contractorId === contractorId && !state.disposalEvents.some((event) => event.caseId === plan.caseId && event.stage === 'handed-off')).filter((plan, index, plans) => plans.findIndex((item) => item.caseId === plan.caseId) === index).map((original) => {
    const currentPlan = state.plannedHandoffs.filter((plan) => plan.caseId === original.caseId).at(-1) ?? original
    const eligible = Boolean(certified && contractorEligibility(certified, original.scheduledOn).eligible)
    const owner = state.followUps.filter((item) => item.caseId === original.caseId).at(-1)?.owner ?? state.cases.find((item) => item.caseId === original.caseId)?.fieldOwner ?? 'unassigned'
    return { caseId: original.caseId, owner, originalPlanId: original.id, currentPlanId: currentPlan.id, scheduledOn: currentPlan.scheduledOn, contractorId, certificationRevision: effective?.sourceRevision ?? null, certificationEventId: effective?.id ?? null, replacementContractorId: currentPlan.contractorId === contractorId ? null : currentPlan.contractorId, status: currentPlan.contractorId !== contractorId ? 'reassigned' as const : eligible ? 'eligible' as const : 'blocked' as const, reason: currentPlan.contractorId !== contractorId ? 'Replacement custody plan recorded' : !certified ? 'Contractor source missing' : !certified.active ? 'Contractor authorization suspended' : `Certification does not cover ${original.scheduledOn}` }
  })
}
export function custodyRemediationProgress(state: MeterWorkloadState, contractorId: string, asOf: string) {
  const cases = contractorCertificationImpact(state, contractorId, asOf).map((impact) => {
    const deferral = state.remediationDeferrals.filter((item) => item.caseId === impact.caseId && item.affectedHandoffId === impact.originalPlanId && item.certificationEventId === impact.certificationEventId).at(-1) ?? null
    const reviewDue = Boolean(deferral && asOf >= deferral.reviewOn)
    const outcome = impact.status === 'reassigned' ? 'reassigned' as const : impact.status === 'blocked' && deferral ? 'deferred' as const : impact.status === 'blocked' ? 'unresolved' as const : 'eligible' as const
    return { ...impact, deferral, reviewDue, outcome, candidates: state.contractors.filter((item) => item.id !== impact.contractorId && contractorEligibility(item, impact.scheduledOn).eligible).map((item) => item.id) }
  })
  return { cases, total: cases.length, reassigned: cases.filter((item) => item.outcome === 'reassigned').length, deferred: cases.filter((item) => item.outcome === 'deferred').length, unresolved: cases.filter((item) => item.outcome === 'unresolved').length }
}

export function deferCustodyRemediation(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; affectedHandoffId: string; certificationEventId: string; owner: string; reason: string; reviewOn: string; deferredOn: string }) {
  if (state.remediationDeferrals.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Custody impact changed. Refresh before deferring this case.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can defer a blocked custody plan.', command.caseId)
  const impact = contractorCertificationImpact(state, state.plannedHandoffs.find((item) => item.id === command.affectedHandoffId)?.contractorId ?? '', command.deferredOn).find((item) => item.caseId === command.caseId)
  if (impact?.status !== 'blocked' || impact.originalPlanId !== command.affectedHandoffId || impact.certificationEventId !== command.certificationEventId) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Only the current blocked custody impact can be deferred.', command.caseId)
  if (state.remediationDeferrals.some((item) => item.caseId === command.caseId && !state.deferralReviews.some((review) => review.deferralId === item.id))) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Review the current deferred plan before deferring again.', command.caseId)
  if (!command.owner.trim() || command.reason.trim().length < 15 || command.reviewOn <= command.deferredOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Owner, specific reason, and future review date are required.', command.caseId)
  const next = structuredClone(state)
  next.remediationDeferrals.push({ id: command.id, caseId: command.caseId, affectedHandoffId: command.affectedHandoffId, certificationEventId: command.certificationEventId, owner: command.owner.trim(), reason: command.reason.trim(), reviewOn: command.reviewOn, deferredOn: command.deferredOn, immutable: true })
  next.revision += 1
  return next
}
export function reviewDeferredCustodyPlan(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; deferralId: string; decision: CustodyDeferralReview['decision']; reviewedBy: string; reviewedOn: string; evidenceReference: string; nextReviewOn?: string; replacementContractorId?: string; scheduledOn?: string }) {
  if (state.deferralReviews.some((item) => item.id === command.id)) return state
  const deferral = state.remediationDeferrals.find((item) => item.id === command.deferralId)
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Deferred custody changed. Refresh before supervisor review.', deferral?.caseId ?? command.deferralId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can review deferred custody.', deferral?.caseId ?? command.deferralId)
  if (!deferral || state.remediationDeferrals.filter((item) => item.caseId === deferral.caseId).at(-1)?.id !== deferral.id || state.deferralReviews.some((item) => item.deferralId === deferral.id)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'The current unreviewed deferral is required.', deferral?.caseId ?? command.deferralId)
  const readiness = plannedCustodyReadiness(state, deferral.caseId)
  if (!readiness?.reassignmentRequired || state.disposalEvents.some((item) => item.caseId === deferral.caseId && item.stage === 'handed-off')) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Only a future blocked handoff can be reviewed.', deferral.caseId)
  if (!command.reviewedBy.trim() || command.reviewedBy === deferral.owner || !command.evidenceReference.trim() || command.reviewedOn < deferral.deferredOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Independent supervisor, review evidence, and valid business date are required.', deferral.caseId)
  let next = structuredClone(state)
  let replacementPlanId: string | null = null
  if (command.decision === 'continue') {
    if (!command.nextReviewOn || command.nextReviewOn <= command.reviewedOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Continued deferment requires a new future review date.', deferral.caseId)
    next.remediationDeferrals.push({ ...deferral, id: `${command.id}:deferral`, owner: command.reviewedBy.trim(), reason: `Continued after review ${command.evidenceReference.trim()}`, deferredOn: command.reviewedOn, reviewOn: command.nextReviewOn })
  } else {
    if (!command.replacementContractorId || !command.scheduledOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Reassignment requires an eligible replacement and scheduled date.', deferral.caseId)
    replacementPlanId = `${command.id}:plan`
    next = reassignPlannedCustodyHandoff(next, { id: replacementPlanId, expectedRevision: next.revision, role: command.role, caseId: deferral.caseId, contractorId: command.replacementContractorId, scheduledOn: command.scheduledOn, reassignedBy: command.reviewedBy, reassignedOn: command.reviewedOn, reason: `Reviewed deferred custody: ${command.evidenceReference.trim()}` })
  }
  next.deferralReviews.push({ id: command.id, deferralId: deferral.id, caseId: deferral.caseId, decision: command.decision, reviewedBy: command.reviewedBy.trim(), reviewedOn: command.reviewedOn, evidenceReference: command.evidenceReference.trim(), nextReviewOn: command.decision === 'continue' ? command.nextReviewOn ?? null : null, replacementPlanId, immutable: true })
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
interface CoordinateFollowUp { scope?: 'field custody'; id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; owner: string; scheduledOn: string; asOf: string; contactEvidence: string; escalationReason: string }

export function coordinateMeterFollowUp(state: MeterWorkloadState, command: CoordinateFollowUp) {
  if (state.followUps.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before coordinating follow-up.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can coordinate both owners.', command.caseId)
  const source = state.cases.find((item) => item.caseId === command.caseId)
  if (!source) throw new Error('Meter case was not found.')
  if (command.scope === 'field custody' ? source.disposalEvidence === 'valid' || state.closures.some((item) => item.caseId === source.caseId) : meterCaseWorkload([source], command.asOf)[0]?.priority !== 'urgent') throw new Error('Urgent recovery or an unresolved field-custody case is required for accountable follow-up.')
  if (command.scheduledOn <= command.asOf) throw new Error('Follow-up must be scheduled after the current business date.')
  if (command.contactEvidence.trim().length < 15 || command.escalationReason.trim().length < 20) throw new Error('Contact evidence and escalation reason are required.')
  const next = structuredClone(state)
  const target = next.cases.find((item) => item.caseId === source.caseId)
  if (!target) throw new Error('Meter case disappeared during the workload update.')
  next.followUps.push({ id: command.id, caseId: source.caseId, previousFieldOwner: source.fieldOwner, previousCustomerOwner: source.customerOwner, owner: command.owner, scheduledOn: command.scheduledOn, contactEvidence: command.contactEvidence.trim(), escalationReason: command.escalationReason.trim(), status: 'scheduled', ...(command.scope ? { scope: command.scope } : {}), immutable: true })
  next.operationalEvents.push(
    ...(command.scope === 'field custody' ? [] : [{ id: `${command.id}:contact`, caseId: source.caseId, kind: 'customer-contact', stream: 'customer', actor: command.owner, occurredOn: command.asOf, sourceRevision: state.revision, evidenceReference: command.contactEvidence.trim(), meaning: 'Customer obligation confirmed for coordinated recovery.', immutable: true as const } as MeterOperationalEvent]),
    { id: `${command.id}:transfer`, caseId: source.caseId, kind: 'responsibility-transfer', stream: 'field-custody', actor: command.owner, occurredOn: command.asOf, sourceRevision: state.revision, evidenceReference: command.escalationReason.trim(), meaning: command.scope === 'field custody' ? `Field custody responsibility transferred from ${source.fieldOwner}; customer ownership remains ${source.customerOwner}.` : `Field and customer responsibility transferred from ${source.fieldOwner} / ${source.customerOwner}.`, immutable: true },
  )
  target.fieldOwner = command.owner
  if (command.scope !== 'field custody') target.customerOwner = command.owner
  if (command.scope !== 'field custody') target.contactAttempts += 1
  next.revision += 1
  return next
}

export function custodyAuthorizationReadiness(state: MeterWorkloadState, caseId: string) {
  const planned = plannedCustodyReadiness(state, caseId)
  const history = state.disposalEvents.filter((item) => item.caseId === caseId)
  const authorization = history.filter((item) => item.stage === 'authorized').at(-1) ?? null
  const amendment = authorization && planned ? state.custodyAmendments.find((item) => item.authorizationEventId === authorization.id && item.planId === planned.plan.id && item.replacementContractorId === planned.plan.contractorId) ?? null : null
  const transferred = history.some((item) => item.stage === 'handed-off')
  const amendmentRequired = Boolean(!transferred && authorization && planned && authorization.contractorId !== planned.plan.contractorId && !amendment)
  return { authorization, amendment, amendmentRequired, transferred, plan: planned?.plan ?? null, ready: !amendmentRequired && Boolean(planned?.ready) }
}

export function amendMeterCustodyAuthorization(state: MeterWorkloadState, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; planId: string; authorizationEventId: string; reason: string; approvalEvidence: string; approvedBy: string; approvedOn: string }) {
  if (state.custodyAmendments.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Custody changed. Refresh before authorization amendment.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can amend pre-transfer custody authorization.', command.caseId)
  const readiness = custodyAuthorizationReadiness(state, command.caseId)
  const planned = plannedCustodyReadiness(state, command.caseId)
  const authorization = readiness.authorization
  if (!readiness.amendmentRequired || !planned?.ready || planned.plan.id !== command.planId || authorization?.id !== command.authorizationEventId || !authorization.contractorId || !planned.plan.previousHandoffId || state.disposalEvents.filter((item) => item.caseId === command.caseId).at(-1)?.stage !== 'authorized') throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Current reassigned plan and unexecuted custody authorization are required.', command.caseId)
  const approvedDate = new Date(command.approvedOn + 'T00:00:00Z')
  if (!command.id.trim() || command.reason.trim().length < 15 || !command.approvalEvidence.trim() || !command.approvedBy.trim() || command.approvedBy.trim() === authorization.actor.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.approvedOn) || !Number.isFinite(approvedDate.getTime()) || approvedDate.toISOString().slice(0, 10) !== command.approvedOn || command.approvedOn < authorization.occurredOn.slice(0, 10) || command.approvedOn > planned.plan.scheduledOn) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Independent supervisor, reason, approval evidence, and valid date between authorization and transfer are required.', command.caseId)
  const next = structuredClone(state)
  next.custodyAmendments.push({ id: command.id, caseId: command.caseId, planId: planned.plan.id, authorizationEventId: authorization.id, previousContractorId: authorization.contractorId, replacementContractorId: planned.plan.contractorId, custodyReference: authorization.custodyReference, reason: command.reason.trim(), approvalEvidence: command.approvalEvidence.trim(), approvedBy: command.approvedBy.trim(), approvedOn: command.approvedOn, immutable: true })
  next.revision += 1
  return next
}
interface RecordMeterDisposalStage { operatorId?: string; reviewedEvidenceEventId?: string; certificateReference?: string; id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; stage: MeterDisposalStage; contractor: string; contractorId?: string; custodyReference: string; evidenceReference: string; reason: string | null; actor: string; occurredOn: string }
function validDisposalCertificateReview(review: {
  operatorId?: string; id: string; caseId: string; stage: MeterDisposalStage; certificateReference?: string;
  reviewedEvidenceEventId?: string; custodyReference: string; contractor: string;
  actor: string; evidenceReference: string; reason: string | null; occurredOn: string;
}, submitted: MeterDisposalEvent | undefined) {
  if (!submitted || submitted.id !== review.reviewedEvidenceEventId
    || submitted.caseId !== review.caseId || !['received', 'evidence-corrected'].includes(submitted.stage)
    || !['confirmed', 'evidence-rejected'].includes(review.stage)
    || submitted.custodyReference !== review.custodyReference || submitted.contractor !== review.contractor) return false
  const date = new Date(review.occurredOn + 'T00:00:00Z')
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(review.occurredOn)
    && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === review.occurredOn
  return Boolean(review.id.trim() && review.certificateReference?.trim()
    && (!submitted.certificateReference || submitted.certificateReference === review.certificateReference)
    && review.actor.trim() && review.evidenceReference.trim()
    && (submitted.operatorId ? Boolean(review.operatorId && review.operatorId !== submitted.operatorId) : review.actor.trim() !== submitted.actor.trim())
    && validDate && review.occurredOn >= submitted.occurredOn.slice(0, 10)
    && (review.stage !== 'evidence-rejected' || (review.reason?.trim().length ?? 0) >= 15))
}
export function recordMeterDisposalStage(state: MeterWorkloadState, command: RecordMeterDisposalStage) {
  if (state.disposalEvents.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before recording disposal custody.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can authorize disposal custody changes.', command.caseId)
  if (state.closures.some((item) => item.caseId === command.caseId)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Closed case custody remains immutable.', command.caseId)
  if (!state.followUps.some((item) => item.caseId === command.caseId)) throw new MeterCaseError('FOLLOW_UP_REQUIRED', 'Coordinated follow-up is required before disposal handoff.', command.caseId)
  const history = state.disposalEvents.filter((item) => item.caseId === command.caseId)
  if (history.some((item) => item.operatorId) && !command.operatorId) throw new Error('An operator-bound custody chain must retain explicit operator attribution.')
  if (command.operatorId) requireMeterOperator(state.operators ?? meterOperators, command.operatorId, ['confirmed', 'evidence-rejected'].includes(command.stage) ? 'certificate review' : 'custody', command.actor, command.occurredOn, history.at(-1)?.occurredOn ?? '')
  const previous = history.at(-1)?.stage
  const allowed: Record<MeterDisposalStage, MeterDisposalStage[]> = { requested: [], authorized: ['requested'], 'handed-off': ['authorized'], received: ['handed-off'], 'evidence-rejected': ['received', 'evidence-corrected'], 'evidence-corrected': ['evidence-rejected'], confirmed: ['received', 'evidence-corrected'] }
  if ((command.stage === 'requested' && history.length > 0) || (command.stage !== 'requested' && (!previous || !allowed[command.stage].includes(previous)))) throw new Error(`Disposal stage ${command.stage} cannot follow ${previous ?? 'no custody record'}.`)
  if (!command.contractor || !command.custodyReference || !command.evidenceReference || (command.stage === 'evidence-rejected' && !command.reason?.trim())) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Contractor, custody, stage evidence, and rejection reasons must be retained.', command.caseId)
  const contractor = state.contractors.find((item) => item.id === command.contractorId || item.organizationName === command.contractor)
  const planned = plannedCustodyReadiness(state, command.caseId)
  if (command.stage === 'handed-off' && planned && (planned.plan.contractorId !== contractor?.id || planned.plan.scheduledOn !== command.occurredOn.slice(0, 10))) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Custody handoff must match the current planned contractor and date.', command.caseId)
  if (command.stage === 'handed-off' && (!contractor || !contractorEligibility(contractor, command.occurredOn.slice(0, 10)).eligible)) throw new MeterCaseError('UNAUTHORIZED', 'Custody can only be handed to an active contractor authorized and certified for meter disposal.', command.caseId)
  const amendment = custodyAuthorizationReadiness(state, command.caseId).amendment
  const amendedTransfer = command.stage === 'handed-off' && amendment?.replacementContractorId === contractor?.id && amendment?.custodyReference === command.custodyReference && amendment.approvedOn <= command.occurredOn.slice(0, 10)
  if (history.length > 0 && history.at(-1)?.contractor !== (contractor?.organizationName ?? command.contractor) && !amendedTransfer) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Disposal contractor cannot change within the custody chain without a governed pre-transfer authorization amendment.', command.caseId)
  if (history.length > 0 && history[0]?.custodyReference !== command.custodyReference) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'The selected case custody reference must remain consistent across its disposal chain.', command.caseId)
  const pinnedCertificateChain = history.some((item) => ['received', 'evidence-corrected'].includes(item.stage) && item.certificateReference)
  if (command.stage === 'evidence-corrected' && pinnedCertificateChain && !command.certificateReference?.trim()) {
    throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Corrected evidence must retain an explicit certificate reference for this pinned custody chain.', command.caseId)
  }
  if (command.reviewedEvidenceEventId || (history.at(-1)?.certificateReference && ['confirmed', 'evidence-rejected'].includes(command.stage))) {
    if (!validDisposalCertificateReview(command, history.at(-1))) {
      throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Current certificate requires a pinned independent review with valid evidence and date.', command.caseId)
    }
  } else if (command.certificateReference !== undefined) {
    if (!['received', 'evidence-corrected'].includes(command.stage) || !command.certificateReference.trim()) {
      throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Submitted disposal evidence requires a certificate reference.', command.caseId)
    }
    const submittedDate = new Date(command.occurredOn + 'T00:00:00Z')
    const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.occurredOn)
      && Number.isFinite(submittedDate.getTime()) && submittedDate.toISOString().slice(0, 10) === command.occurredOn
    if (!command.id.trim() || !command.actor.trim() || !validDate || command.occurredOn < (history.at(-1)?.occurredOn.slice(0, 10) ?? '')) {
      throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Certificate submission requires attribution and a valid date after prior custody evidence.', command.caseId)
    }
    const previousEvidence = history.filter((item) => item.stage === 'received' || item.stage === 'evidence-corrected').at(-1)
    if (command.stage === 'evidence-corrected' && previousEvidence?.certificateReference === command.certificateReference.trim()
      && previousEvidence.evidenceReference === command.evidenceReference) {
      throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Correction must supply changed certificate or supporting evidence; prior evidence remains immutable.', command.caseId)
    }
  }
  const next = structuredClone(state)
  next.disposalEvents.push({ ...command, contractor: contractor?.organizationName ?? command.contractor, ...(contractor ? { contractorId: contractor.id, contractorOperationalReference: contractor.operationalReference } : {}), reason: command.reason?.trim() ?? null, sourceRevision: state.revision, immutable: true })
  next.revision += 1
  return next
}


export function reviewMeterDisposalCertificate(state: MeterWorkloadState, command: {
  operatorId?: string; id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string;
  expectedEvidenceEventId: string; decision: 'accept' | 'return'; certificateReference: string;
  evidenceReference: string; reason: string; reviewedBy: string; reviewedOn: string;
}) {
  if (state.disposalEvents.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) {
    throw new MeterCaseError('STALE_REVISION', 'Disposal evidence changed. Refresh before independent certificate review.', command.caseId)
  }
  if (command.role !== 'Operations Supervisor') {
    throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can independently review disposal evidence.', command.caseId)
  }
  const submitted = state.disposalEvents.filter((item) => item.caseId === command.caseId).at(-1)
  if (!submitted || !['received', 'evidence-corrected'].includes(submitted.stage) || submitted.id !== command.expectedEvidenceEventId) {
    throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Review the current received or corrected evidence for this case.', command.caseId)
  }
  const reviewedDate = new Date(command.reviewedOn + 'T00:00:00Z')
  const validDate = /^20\d{2}-\d{2}-\d{2}$/.test(command.reviewedOn)
    && Number.isFinite(reviewedDate.getTime()) && reviewedDate.toISOString().slice(0, 10) === command.reviewedOn
  if (!command.id.trim() || !command.reviewedBy.trim() || (submitted.operatorId ? command.operatorId === submitted.operatorId : command.reviewedBy.trim() === submitted.actor.trim())
    || !command.certificateReference.trim() || !command.evidenceReference.trim() || !validDate
    || command.reviewedOn < submitted.occurredOn.slice(0, 10)) {
    throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Independent reviewer, exact certificate, review evidence and a valid date after receipt are required.', command.caseId)
  }
  if (submitted.certificateReference && submitted.certificateReference !== command.certificateReference.trim()) {
    throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Review must identify the exact submitted certificate; submit a correction before changing it.', command.caseId)
  }
  if (command.decision === 'return' && command.reason.trim().length < 15) {
    throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Returning a certificate requires a specific correction reason.', command.caseId)
  }

  const next = recordMeterDisposalStage(state, {
    id: command.id, expectedRevision: command.expectedRevision, role: command.role, caseId: command.caseId,
    stage: command.decision === 'accept' ? 'confirmed' : 'evidence-rejected', contractor: submitted.contractor,
    ...(submitted.contractorId ? { contractorId: submitted.contractorId } : {}), custodyReference: submitted.custodyReference,
    evidenceReference: command.evidenceReference.trim(), reason: command.decision === 'return' ? command.reason.trim() : null,
    ...(command.operatorId ? { operatorId: command.operatorId } : {}), actor: command.reviewedBy.trim(), occurredOn: command.reviewedOn,
    reviewedEvidenceEventId: submitted.id, certificateReference: command.certificateReference.trim(),
  })
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

interface CloseMeterCase { operatorId?: string; id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; customerAcknowledgement: string; disposalCertificate: string; billingAdjustmentReference: string; paymentPlanReference: string; fieldActionsOpen: number; reviewedBy: string; closedOn: string }
export function closeMeterCase(state: MeterWorkloadState, command: CloseMeterCase) {
  if (state.closures.some((item) => item.id === command.id)) return state
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter workload changed. Refresh before closure.', command.caseId)
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can independently close a meter case.', command.caseId)
  const source = state.cases.find((item) => item.caseId === command.caseId)
  const followUp = [...state.followUps].reverse().find((item) => item.caseId === command.caseId)
  if (!source || !followUp) throw new MeterCaseError('FOLLOW_UP_REQUIRED', 'Coordinated customer and field follow-up is required before closure.', command.caseId)
  const disposalHistory = state.disposalEvents.filter((item) => item.caseId === command.caseId)
  if (disposalHistory.some((item) => item.operatorId) && !command.operatorId) throw new Error('An operator-bound custody chain requires an explicitly attributed closure.')
  if (command.operatorId) requireMeterOperator(state.operators ?? meterOperators, command.operatorId, 'closure', command.reviewedBy, command.closedOn, disposalHistory.at(-1)?.occurredOn ?? '')
  if (disposalHistory.length > 0 && disposalHistory.at(-1)?.stage !== 'confirmed') throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Confirmed contractor disposal evidence is required before custody closure.', command.caseId)
  const confirmation = disposalHistory.at(-1)
  if (confirmation?.reviewedEvidenceEventId && confirmation.certificateReference !== command.disposalCertificate.trim()) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'Closure must retain the independently accepted disposal certificate.', command.caseId)
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

export interface MeterCaseRecoverySnapshot {
  schemaVersion: 1
  id: string
  caseId: string
  sourceRevision: number
  createdOn: string
  caseRecord: MeterOperationalCase
  followUps: MeterFollowUp[]
  operationalEvents: MeterOperationalEvent[]
  disposalEvents: MeterDisposalEvent[]
  plannedHandoffs: PlannedCustodyHandoff[]
  remediationDeferrals: CustodyRemediationDeferral[]
  deferralReviews: CustodyDeferralReview[]
  eligibilityNotices: CustodyEligibilityNotice[]
  noticeAcknowledgements: CustodyNoticeAcknowledgement[]
  closures: MeterCaseClosure[]
  custodyAmendments?: CustodyAuthorizationAmendment[]
  contractorIds: string[]
}

export function captureMeterCaseSnapshot(state: MeterWorkloadState, command: { id: string; caseId: string; role: MeterWorkloadRole; createdOn: string }): MeterCaseRecoverySnapshot {
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can capture meter recovery evidence.', command.caseId)
  const record = state.cases.find((item) => item.caseId === command.caseId)
  if (!record || !command.id.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(command.createdOn)) throw new MeterCaseError('EVIDENCE_INCOMPLETE', 'A named meter case and business date are required.', command.caseId)
  const followUps = state.followUps.filter((item) => item.caseId === command.caseId)
  const operationalEvents = state.operationalEvents.filter((item) => item.caseId === command.caseId)
  const disposalEvents = state.disposalEvents.filter((item) => item.caseId === command.caseId)
  const plannedHandoffs = state.plannedHandoffs.filter((item) => item.caseId === command.caseId)
  const remediationDeferrals = state.remediationDeferrals.filter((item) => item.caseId === command.caseId)
  const deferralIds = new Set(remediationDeferrals.map((item) => item.id))
  const deferralReviews = state.deferralReviews.filter((item) => deferralIds.has(item.deferralId))
  const planIds = new Set(plannedHandoffs.map((item) => item.id))
  const eligibilityNotices = state.eligibilityNotices.filter((item) => planIds.has(item.handoffId))
  const noticeIds = new Set(eligibilityNotices.map((item) => item.id))
  const noticeAcknowledgements = state.noticeAcknowledgements.filter((item) => noticeIds.has(item.noticeId))
  const contractorIds = [...new Set([...plannedHandoffs.map((item) => item.contractorId), ...disposalEvents.map((item) => item.contractorId).filter((id): id is string => Boolean(id))])]
  return structuredClone({ schemaVersion: 1, id: command.id.trim(), caseId: command.caseId, sourceRevision: state.revision, createdOn: command.createdOn, caseRecord: record, followUps, operationalEvents, disposalEvents, custodyAmendments: state.custodyAmendments.filter((item) => item.caseId === command.caseId), plannedHandoffs, remediationDeferrals, deferralReviews, eligibilityNotices, noticeAcknowledgements, closures: state.closures.filter((item) => item.caseId === command.caseId), contractorIds })
}

export function parseMeterCaseSnapshot(raw: string): MeterCaseRecoverySnapshot {
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object') throw new Error('Meter recovery archive is invalid.')
  const value = parsed as Record<string, unknown>
  if (value['schemaVersion'] !== 1) throw new Error('Unsupported meter recovery archive schema.')
  if (typeof value['id'] !== 'string' || typeof value['caseId'] !== 'string' || !Number.isSafeInteger(value['sourceRevision']) || typeof value['createdOn'] !== 'string' || !value['caseRecord'] || typeof value['caseRecord'] !== 'object') throw new Error('Meter recovery archive identity or revision is invalid.')
  const record = value['caseRecord'] as Record<string, unknown>
  if (record['caseId'] !== value['caseId'] || typeof record['accountId'] !== 'string' || typeof record['meterSerial'] !== 'string') throw new Error('Meter recovery archive case identity is invalid.')
  for (const key of ['followUps', 'operationalEvents', 'disposalEvents', 'plannedHandoffs', 'remediationDeferrals', 'deferralReviews', 'eligibilityNotices', 'noticeAcknowledgements', 'closures', 'contractorIds']) if (!Array.isArray(value[key])) throw new Error(`Meter recovery archive is missing ${key}.`)
  for (const key of ['followUps', 'operationalEvents', 'disposalEvents', 'plannedHandoffs', 'remediationDeferrals', 'deferralReviews', 'eligibilityNotices', 'noticeAcknowledgements', 'closures']) if (!(value[key] as unknown[]).every((item) => item && typeof item === 'object' && typeof (item as Record<string, unknown>)['id'] === 'string')) throw new Error(`Meter recovery archive has invalid ${key} evidence.`)
  const disposalEvidence = value['disposalEvents'] as Record<string, unknown>[]
  for (const item of [...disposalEvidence, ...(value['closures'] as Record<string, unknown>[])]) {
    if (item['operatorId'] !== undefined && (typeof item['operatorId'] !== 'string' || !item['operatorId'].trim())) throw new Error('Invalid custody operator reference.')
  }
  const reviewedReceiptIds = new Set(disposalEvidence.map((item) => item['reviewedEvidenceEventId']).filter((id): id is string => typeof id === 'string'))
  for (const item of disposalEvidence) {
    for (const key of ['certificateReference', 'reviewedEvidenceEventId']) {
      const reference = item[key]
      if (reference !== undefined && (typeof reference !== 'string' || !reference.trim())) throw new Error('Meter recovery disposal certificate references are invalid.')
    }
    if ((item['operatorId'] !== undefined || item['reviewedEvidenceEventId'] !== undefined || item['certificateReference'] !== undefined || reviewedReceiptIds.has(item['id'] as string))
      && (!['caseId', 'stage', 'custodyReference', 'contractor', 'actor', 'evidenceReference', 'occurredOn'].every((key) => typeof item[key] === 'string')
        || (item['reason'] !== null && typeof item['reason'] !== 'string'))) throw new Error('Meter recovery disposal certificate review evidence is invalid.')
  }
  if (!(value['contractorIds'] as unknown[]).every((id) => typeof id === 'string')) throw new Error('Meter recovery archive contractor references are invalid.')
  if (value['custodyAmendments'] !== undefined && (!Array.isArray(value['custodyAmendments']) || !(value['custodyAmendments'] as unknown[]).every((item) => item && typeof item === 'object' && ['id', 'caseId', 'planId', 'authorizationEventId', 'previousContractorId', 'replacementContractorId', 'custodyReference', 'approvalEvidence', 'reason', 'approvedBy', 'approvedOn'].every((key) => typeof (item as Record<string, unknown>)[key] === 'string') && (item as Record<string, unknown>)['immutable'] === true))) throw new Error('Meter recovery custody amendments are invalid.')
  return value as unknown as MeterCaseRecoverySnapshot
}

export function previewMeterCaseRestore(state: MeterWorkloadState, snapshot: MeterCaseRecoverySnapshot, caseId: string) {
  const reasons: string[] = []
  const current = state.cases.find((item) => item.caseId === caseId)
  if (snapshot.caseId !== caseId || snapshot.caseRecord.accountId !== current?.accountId || snapshot.caseRecord.meterSerial !== current.meterSerial) reasons.push('Meter case, account, or serial does not match the current source.')
  if (snapshot.sourceRevision !== state.revision) reasons.push('Current meter work changed after this snapshot; older evidence cannot replace newer work.')
  for (const id of snapshot.contractorIds) if (!state.contractors.some((item) => item.id === id)) reasons.push(`Contractor ${id} is missing from the authoritative register.`)
  const referencedContractors = [...new Set([...snapshot.plannedHandoffs.map((item) => item.contractorId), ...snapshot.disposalEvents.map((item) => item.contractorId).filter((id): id is string => Boolean(id))])]
  if (referencedContractors.some((id) => !snapshot.contractorIds.includes(id))) reasons.push('Snapshot contractor references do not cover its custody evidence.')
  const plans = new Map(snapshot.plannedHandoffs.map((item) => [item.id, item]))
  for (const plan of snapshot.plannedHandoffs) {
    if (plan.caseId !== caseId || (plan.previousHandoffId && !plans.has(plan.previousHandoffId))) reasons.push(`Custody plan ${plan.id} has broken case or predecessor lineage.`)
  }
  for (const deferral of snapshot.remediationDeferrals) {
    const plan = plans.get(deferral.affectedHandoffId)
    const certification = state.contractorHistory.find((event) => event.id === deferral.certificationEventId)
    if (!plan || certification?.contractorId !== plan.contractorId) reasons.push(`Deferral ${deferral.id} has no matching authoritative contractor certification event.`)
  }
  for (const review of snapshot.deferralReviews) {
    const deferral = snapshot.remediationDeferrals.find((item) => item.id === review.deferralId)
    const replacement = review.replacementPlanId ? plans.get(review.replacementPlanId) : undefined
    if (!deferral || (review.decision === 'reassign' && replacement?.previousHandoffId !== deferral.affectedHandoffId) || (review.decision === 'continue' && review.replacementPlanId !== null)) reasons.push(`Deferral review ${review.id} has incomplete custody reassignment lineage.`)
  }
  if ((snapshot.custodyAmendments ?? []).some((item) => item.caseId !== caseId || plans.get(item.planId)?.contractorId !== item.replacementContractorId || !snapshot.disposalEvents.some((event) => event.id === item.authorizationEventId && event.stage === 'authorized' && event.contractorId === item.previousContractorId && event.custodyReference === item.custodyReference))) reasons.push('Custody authorization amendment lineage is incomplete.')
  if ((snapshot.custodyAmendments ?? []).some((item) => {
    const authorization = snapshot.disposalEvents.find((event) => event.id === item.authorizationEventId && event.stage === 'authorized')
    const plan = plans.get(item.planId)
    const approvedDate = new Date(item.approvedOn + 'T00:00:00Z')
    return !authorization || !plan || !item.id.trim() || item.reason.trim().length < 15 || !item.approvalEvidence.trim() || !item.approvedBy.trim() || item.approvedBy.trim() === authorization.actor.trim() || !/^20\d{2}-\d{2}-\d{2}$/.test(item.approvedOn) || !Number.isFinite(approvedDate.getTime()) || approvedDate.toISOString().slice(0, 10) !== item.approvedOn || item.approvedOn < authorization.occurredOn.slice(0, 10) || item.approvedOn > plan.scheduledOn
  })) reasons.push('Custody authorization amendment requires independent approval and a valid business date between authorization and transfer.')
  for (const [index, review] of snapshot.disposalEvents.entries()) {
    const history = snapshot.disposalEvents.slice(0, index).filter((item) => item.caseId === review.caseId)
    const submitted = history.at(-1)
    if (history.some((item) => item.operatorId) && !review.operatorId) reasons.push('Archived custody cannot discard explicit operator attribution.')
    if (review.operatorId) {
      const known = state.disposalEvents.find((item) => item.id === review.id)
      if (!known || JSON.stringify(known) !== JSON.stringify(review)) {
        try { requireMeterOperator(state.operators ?? meterOperators, review.operatorId, ['confirmed', 'evidence-rejected'].includes(review.stage) ? 'certificate review' : 'custody', review.actor, review.occurredOn, submitted?.occurredOn ?? '') }
        catch { reasons.push('Archived custody operator authority or business chronology is invalid.') }
      }
    }
    const pinnedChain = history.some((item) => ['received', 'evidence-corrected'].includes(item.stage) && item.certificateReference)
    if (pinnedChain && review.stage === 'evidence-corrected' && !review.certificateReference?.trim()) {
      reasons.push('Corrected disposal evidence cannot discard the pinned certificate identity.')
    }
    if (review.reviewedEvidenceEventId || (submitted?.certificateReference && ['confirmed', 'evidence-rejected'].includes(review.stage))) {
      if (!validDisposalCertificateReview(review, submitted)) {
        reasons.push('Disposal certificate review has invalid evidence lineage, independent authority or date.')
      }
    }
  }
  for (const closure of snapshot.closures) {
    const history = snapshot.disposalEvents.filter((item) => item.caseId === closure.caseId)
    if (history.some((item) => item.operatorId) && !closure.operatorId) reasons.push('Archived closure cannot discard explicit operator attribution.')
    if (closure.operatorId) {
      const known = state.closures.find((item) => item.id === closure.id)
      if (!known || JSON.stringify(known) !== JSON.stringify(closure)) {
        try { requireMeterOperator(state.operators ?? meterOperators, closure.operatorId, 'closure', closure.reviewedBy, closure.closedOn, history.at(-1)?.occurredOn ?? '') }
        catch { reasons.push('Archived closure operator authority or business chronology is invalid.') }
      }
    }
  }
  if (snapshot.closures.some((closure) => {
    const confirmation = snapshot.disposalEvents.filter((item) => item.caseId === closure.caseId).at(-1)
    return confirmation?.reviewedEvidenceEventId && (confirmation.stage !== 'confirmed' || confirmation.certificateReference !== closure.disposalCertificate)
  })) reasons.push('Closure does not retain the accepted disposal certificate.')
  if (snapshot.closures.some((item) => item.caseId !== caseId || !snapshot.followUps.some((followUp) => followUp.id === item.followUpId))) reasons.push('Closure has no matching case follow-up evidence.')
  if (snapshot.eligibilityNotices.some((item) => !plans.has(item.handoffId)) || snapshot.noticeAcknowledgements.some((item) => !snapshot.eligibilityNotices.some((notice) => notice.id === item.noticeId))) reasons.push('Contractor eligibility notice lineage is incomplete.')
  if ([...snapshot.followUps, ...snapshot.operationalEvents, ...snapshot.disposalEvents, ...snapshot.plannedHandoffs, ...snapshot.remediationDeferrals, ...snapshot.deferralReviews, ...snapshot.closures].some((item) => item.caseId !== caseId)) reasons.push('Historical evidence belongs to another case.')
  const collections = [
    [snapshot.followUps, state.followUps], [snapshot.operationalEvents, state.operationalEvents], [snapshot.disposalEvents, state.disposalEvents],
    [snapshot.plannedHandoffs, state.plannedHandoffs], [snapshot.remediationDeferrals, state.remediationDeferrals], [snapshot.deferralReviews, state.deferralReviews],
    [snapshot.custodyAmendments ?? [], state.custodyAmendments], [snapshot.eligibilityNotices, state.eligibilityNotices], [snapshot.noticeAcknowledgements, state.noticeAcknowledgements], [snapshot.closures, state.closures],
  ] as const
  for (const [archived, currentEvents] of collections) for (const item of archived) {
    const existing = currentEvents.find((event) => event.id === item.id)
    if (existing && JSON.stringify(existing) !== JSON.stringify(item)) reasons.push(`Historical record ${item.id} conflicts with current evidence.`)
  }
  return { ready: reasons.length === 0, reasons, snapshotId: snapshot.id, sourceRevision: snapshot.sourceRevision, currentRevision: state.revision, caseId }
}

export function restoreMeterCaseSnapshot(state: MeterWorkloadState, snapshot: MeterCaseRecoverySnapshot, command: { id: string; expectedRevision: number; role: MeterWorkloadRole; caseId: string; restoredBy: string; restoredOn: string }) {
  if (command.role !== 'Operations Supervisor') throw new MeterCaseError('UNAUTHORIZED', 'Only an operations supervisor can restore a meter case.', command.caseId)
  if (state.revision !== command.expectedRevision) throw new MeterCaseError('STALE_REVISION', 'Meter case changed before recovery could be applied.', command.caseId)
  const preview = previewMeterCaseRestore(state, snapshot, command.caseId)
  if (!preview.ready || !command.id.trim() || !command.restoredBy.trim()) throw new MeterCaseError('EVIDENCE_INCOMPLETE', preview.reasons.join(' ') || 'Recovery identity and actor are required.', command.caseId)
  const next = structuredClone(state)
  const index = next.cases.findIndex((item) => item.caseId === command.caseId)
  next.cases[index] = structuredClone(snapshot.caseRecord)
  const mergeHistory = <T extends { id: string }>(current: T[], archived: T[]) => [...current, ...structuredClone(archived).filter((item) => !current.some((existing) => existing.id === item.id))]
  next.followUps = mergeHistory(next.followUps, snapshot.followUps)
  next.operationalEvents = mergeHistory(next.operationalEvents, snapshot.operationalEvents)
  next.disposalEvents = mergeHistory(next.disposalEvents, snapshot.disposalEvents)
  next.custodyAmendments = mergeHistory(next.custodyAmendments, snapshot.custodyAmendments ?? [])
  next.plannedHandoffs = mergeHistory(next.plannedHandoffs, snapshot.plannedHandoffs)
  next.remediationDeferrals = mergeHistory(next.remediationDeferrals, snapshot.remediationDeferrals)
  next.deferralReviews = mergeHistory(next.deferralReviews, snapshot.deferralReviews)
  next.eligibilityNotices = mergeHistory(next.eligibilityNotices, snapshot.eligibilityNotices)
  next.noticeAcknowledgements = mergeHistory(next.noticeAcknowledgements, snapshot.noticeAcknowledgements)
  next.closures = mergeHistory(next.closures, snapshot.closures)
  next.operationalEvents.push({ id: command.id, caseId: command.caseId, kind: 'recovery-restoration', stream: 'field-custody', actor: command.restoredBy.trim(), occurredOn: command.restoredOn, sourceRevision: state.revision, evidenceReference: snapshot.id, meaning: 'Verified meter case recovery snapshot restored.', immutable: true })
  next.revision += 1
  return next
}

export interface MeterWorkloadPersistence {
  load(): MeterWorkloadState | null
  save(state: MeterWorkloadState): void
}
export class BrowserMeterWorkloadPersistence implements MeterWorkloadPersistence {
  static key = 'gridloom:meter-workload:v2'
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage }
  load() { const raw = this.storage.getItem(BrowserMeterWorkloadPersistence.key); if (!raw) return null; const saved = JSON.parse(raw) as Omit<Partial<MeterWorkloadState>, 'contractors'> & { contractors?: (Omit<MeterDisposalContractor, 'certificationExpiresOn'> & { certificationExpiresOn?: string })[] }; return { ...(saved as MeterWorkloadState), operators: saved.operators ?? structuredClone(meterOperators), operationalEvents: saved.operationalEvents ?? [], disposalEvents: saved.disposalEvents ?? [], custodyAmendments: saved.custodyAmendments ?? [], contractors: (saved.contractors ?? structuredClone(meterDisposalContractors)).map((item) => ({ ...item, certificationExpiresOn: item.certificationExpiresOn ?? '2026-11-30' })), contractorHistory: saved.contractorHistory ?? [], plannedHandoffs: saved.plannedHandoffs ?? [], remediationDeferrals: saved.remediationDeferrals ?? [], deferralReviews: saved.deferralReviews ?? [], eligibilityNotices: saved.eligibilityNotices ?? [], noticeAcknowledgements: saved.noticeAcknowledgements ?? [] } }
  save(state: MeterWorkloadState) { this.storage.setItem(BrowserMeterWorkloadPersistence.key, JSON.stringify(state)) }
}
export class MeterWorkloadRepository {
  private readonly persistence: MeterWorkloadPersistence
  constructor(persistence: MeterWorkloadPersistence) { this.persistence = persistence }
  read(): MeterWorkloadState { return this.persistence.load() ?? structuredClone(initialMeterWorkloadState) }
  dispatch(command: Parameters<typeof reviewMeterDisposalCertificate>[1] | CoordinateFollowUp | RecordMeterDisposalStage | CloseMeterCase | Parameters<typeof setDisposalContractorActive>[1] | Parameters<typeof planMeterCustodyHandoff>[1] | Parameters<typeof reassignPlannedCustodyHandoff>[1] | Parameters<typeof deferCustodyRemediation>[1] | Parameters<typeof reviewDeferredCustodyPlan>[1] | Parameters<typeof acknowledgeCustodyEligibilityNotice>[1] | Parameters<typeof amendMeterCustodyAuthorization>[1]) { const current = this.read(); const next = 'expectedEvidenceEventId' in command ? reviewMeterDisposalCertificate(current, command) : 'authorizationEventId' in command ? amendMeterCustodyAuthorization(current, command) : 'deferralId' in command ? reviewDeferredCustodyPlan(current, command) : 'noticeId' in command ? acknowledgeCustodyEligibilityNotice(current, command) : 'affectedHandoffId' in command ? deferCustodyRemediation(current, command) : 'reassignedBy' in command ? reassignPlannedCustodyHandoff(current, command) : 'scheduledOn' in command && 'contractorId' in command ? planMeterCustodyHandoff(current, command) : 'contractorId' in command && 'active' in command ? setDisposalContractorActive(current, command) : 'disposalCertificate' in command ? closeMeterCase(current, command) : 'stage' in command ? recordMeterDisposalStage(current, command) : coordinateMeterFollowUp(current, command); if (next !== current) this.persistence.save(next); return next }
  restore(snapshot: MeterCaseRecoverySnapshot, command: Parameters<typeof restoreMeterCaseSnapshot>[2]) { const next = restoreMeterCaseSnapshot(this.read(), snapshot, command); this.persistence.save(next); return next }
}
