import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it } from 'vitest'
import { MeterWorkloadControl } from './MeterWorkloadControl'
import { meterOperators } from './meter-operators'
import { BrowserMeterWorkloadPersistence, captureMeterCaseSnapshot, closeMeterCase, coordinateMeterFollowUp, initialMeterWorkloadState, parseMeterCaseSnapshot, previewMeterCaseRestore, recordMeterDisposalStage, reviewMeterDisposalCertificate, type MeterDisposalStage, type MeterWorkloadState } from './meter-control-domain'

function coordinated() { return coordinateMeterFollowUp(initialMeterWorkloadState, { id: 'follow', expectedRevision: 0, role: 'Operations Supervisor', caseId: 'MX-905', owner: 'Revenue recovery', scheduledOn: '2026-10-21', asOf: '2026-10-20', contactEvidence: 'Customer contact recorded for this case.', escalationReason: 'Custody and payment need coordinated follow-up.' }) }
function advance(state: MeterWorkloadState, stage: MeterDisposalStage, extra: Partial<Parameters<typeof recordMeterDisposalStage>[1]> = {}) {
  return recordMeterDisposalStage(state, { id: stage, expectedRevision: state.revision, role: 'Operations Supervisor', caseId: 'MX-905', stage, contractor: 'Circular Meter Services', contractorId: 'CONTRACTOR-CMS', custodyReference: 'CUSTODY-905', evidenceReference: 'EVIDENCE-' + stage, reason: null, actor: 'Field custody operator', operatorId: 'METER-FIELD', occurredOn: '2026-10-22', ...(stage === 'received' ? { certificateReference: 'CERT-905' } : {}), ...extra })
}
function received() { let state = coordinated(); for (const stage of ['requested', 'authorized', 'handed-off', 'received'] as const) state = advance(state, stage); return state }
const review = { id: 'review', expectedRevision: 5, role: 'Operations Supervisor' as const, caseId: 'MX-905', expectedEvidenceEventId: 'received', decision: 'accept' as const, certificateReference: 'CERT-905', evidenceReference: 'INDEPENDENT-SEAL-REVIEW', reason: '', operatorId: 'METER-REVIEW', reviewedBy: 'Independent disposal reviewer', reviewedOn: '2026-10-23' }
const closure = { id: 'closure', expectedRevision: 6, role: 'Operations Supervisor' as const, caseId: 'MX-905', customerAcknowledgement: 'ACK-905', disposalCertificate: 'CERT-905', billingAdjustmentReference: 'BILL-905', paymentPlanReference: 'PLAN-905', fieldActionsOpen: 0, operatorId: 'METER-CUSTODY', reviewedBy: 'Operations assurance', closedOn: '2026-10-24' }
afterEach(() => { cleanup(); localStorage.clear() })

it('enforces current operator identity, duty, active state and valid chronology atomically', () => {
  const state = coordinated(), before = structuredClone(state)
  for (const extra of [
    { operatorId: 'MISSING' }, { operatorId: 'METER-INACTIVE', actor: 'Former meter operator' },
    { operatorId: 'METER-REVIEW', actor: 'Independent disposal reviewer' }, { actor: 'Spoofed actor' },
    { occurredOn: '2026-02-30' },
  ]) expect(() => advance(state, 'requested', extra)).toThrow()
  const requested = advance(state, 'requested')
  expect(() => advance(requested, 'authorized', { occurredOn: '2026-10-21' })).toThrow('business date')
  const ambiguous = structuredClone(state); ambiguous.operators!.push({ ...meterOperators[2]! })
  expect(() => advance(ambiguous, 'requested')).toThrow('operator')
  expect(state).toEqual(before)
})

it('keeps operator IDs and exact dates on receipt, independent review and closure', () => {
  const state = received(), before = structuredClone(state)
  expect(() => reviewMeterDisposalCertificate(state, { ...review, operatorId: 'METER-FIELD', reviewedBy: 'Field custody operator' })).toThrow('Independent')
  expect(() => reviewMeterDisposalCertificate(state, { ...review, reviewedOn: '2026-10-21' })).toThrow('valid date')
  const accepted = reviewMeterDisposalCertificate(state, review)
  expect(() => closeMeterCase(accepted, { ...closure, operatorId: 'METER-FIELD', reviewedBy: 'Field custody operator' })).toThrow('not authorized')
  expect(() => closeMeterCase(accepted, { ...closure, closedOn: '2026-10-22' })).toThrow('business date')
  const closed = closeMeterCase(accepted, closure)
  expect(closed.disposalEvents.at(-1)).toMatchObject({ operatorId: 'METER-REVIEW', reviewedEvidenceEventId: 'received', occurredOn: '2026-10-23' })
  expect(closed.closures[0]).toMatchObject({ operatorId: 'METER-CUSTODY', closedOn: '2026-10-24' })
  expect(closed.cases.find(item => item.caseId === 'MX-905')).toMatchObject({ disposalEvidence: 'valid', balanceCents: 0 })
  expect(state).toEqual(before)
})

it('cannot drop operator attribution or self-review under a changed display name', () => {
  const state = received()
  const renamed = structuredClone(state)
  const operator = renamed.operators!.find(item => item.id === 'METER-FIELD')!
  operator.displayName = 'Renamed operator'; operator.duties.push('certificate review')
  expect(() => reviewMeterDisposalCertificate(renamed, { ...review, operatorId: operator.id, reviewedBy: operator.displayName })).toThrow('Independent reviewer')
  const sameName = structuredClone(state)
  sameName.operators!.find(item => item.id === 'METER-REVIEW')!.displayName = 'Field custody operator'
  expect(reviewMeterDisposalCertificate(sameName, { ...review, reviewedBy: 'Field custody operator' }).disposalEvents.at(-1)?.operatorId).toBe('METER-REVIEW')
  const unpinned: Parameters<typeof reviewMeterDisposalCertificate>[1] = { ...review }; delete unpinned.operatorId
  expect(() => reviewMeterDisposalCertificate(state, unpinned)).toThrow('explicit operator')
  const accepted = reviewMeterDisposalCertificate(state, review)
  const unpinnedClosure: Parameters<typeof closeMeterCase>[1] = { ...closure }; delete unpinnedClosure.operatorId
  expect(() => closeMeterCase(accepted, unpinnedClosure)).toThrow('explicitly attributed closure')
})

it('preserves operator evidence on reload and accepts known historical events after an operator becomes inactive', () => {
  const state = closeMeterCase(reviewMeterDisposalCertificate(received(), review), closure)
  const persistence = new BrowserMeterWorkloadPersistence(localStorage)
  persistence.save(state)
  expect(persistence.load()?.disposalEvents).toEqual(state.disposalEvents)
  const archived = parseMeterCaseSnapshot(JSON.stringify(captureMeterCaseSnapshot(state, { id: 'archive', caseId: 'MX-905', role: 'Operations Supervisor', createdOn: '2026-10-24' })))
  const later = structuredClone(state); later.operators!.forEach(item => { item.active = false })
  expect(previewMeterCaseRestore(later, archived, 'MX-905').ready).toBe(true)
  const forged = structuredClone(archived); forged.disposalEvents[0]!.id = 'forged'
  expect(previewMeterCaseRestore(later, forged, 'MX-905').reasons).toContain('Archived custody operator authority or business chronology is invalid.')
  const stripped = structuredClone(archived); delete stripped.closures[0]!.operatorId
  expect(previewMeterCaseRestore(later, stripped, 'MX-905').reasons).toContain('Archived closure cannot discard explicit operator attribution.')
})

it('loads legacy custody without attributing it to newly available directory operators', () => {
  const state = advance(coordinated(), 'requested')
  delete state.operators
  delete state.disposalEvents[0]!.operatorId
  state.disposalEvents[0]!.actor = 'Historical field team'
  localStorage.setItem(BrowserMeterWorkloadPersistence.key, JSON.stringify(state))
  const loaded = new BrowserMeterWorkloadPersistence(localStorage).load()!
  expect(loaded.operators).toEqual(meterOperators)
  expect(loaded.disposalEvents).toEqual(state.disposalEvents)
  expect(loaded.disposalEvents[0]?.operatorId).toBeUndefined()
  const next = advance(loaded, 'authorized')
  expect(next.disposalEvents[0]).toEqual(state.disposalEvents[0])
  expect(next.disposalEvents[1]?.operatorId).toBe('METER-FIELD')
})

it('retains selected operator and case date after a denied action, refresh and case navigation', async () => {
  const user = userEvent.setup()
  render(<MeterWorkloadControl />)
  await user.selectOptions(screen.getByLabelText('Workload role'), 'Operations Supervisor')
  await user.click(screen.getByRole('button', { name: 'Coordinate urgent meter follow-up' }))
  await user.selectOptions(screen.getByLabelText('Custody execution operator'), 'METER-INACTIVE')
  fireEvent.change(screen.getByLabelText('Meter business date'), { target: { value: '2026-10-24' } })
  await user.click(screen.getByRole('button', { name: 'Advance disposal custody' }))
  expect(screen.getByRole('status')).toHaveTextContent('inactive')
  expect(screen.getByRole('status')).toHaveFocus()
  await user.click(screen.getByRole('button', { name: 'Refresh selected meter case' }))
  await user.selectOptions(screen.getByLabelText('Custody case'), 'MX-881')
  expect(screen.getByLabelText('Meter business date')).toHaveValue('')
  await user.selectOptions(screen.getByLabelText('Custody case'), 'MX-905')
  expect(screen.getByLabelText('Meter business date')).toHaveValue('2026-10-24')
  expect(screen.getByLabelText('Custody execution operator')).toHaveValue('METER-INACTIVE')
  await user.selectOptions(screen.getByLabelText('Custody execution operator'), 'METER-FIELD')
  await user.click(screen.getByRole('button', { name: 'Advance disposal custody' }))
  expect(screen.getByRole('list', { name: 'Meter disposal custody history' })).toHaveTextContent('METER-FIELD')
  expect(screen.getByRole('list', { name: 'Meter disposal custody history' })).toHaveTextContent('2026-10-24')
})
