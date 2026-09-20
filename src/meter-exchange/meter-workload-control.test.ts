import { describe, expect, it } from 'vitest'
import { coordinateMeterFollowUp, initialMeterWorkloadState } from './MeterWorkloadControl'

const command = { id: 'follow-1', expectedRevision: 0, role: 'Operations Supervisor' as const, caseId: 'MX-905', owner: 'Revenue recovery', scheduledOn: '2026-10-21', asOf: '2026-10-20', contactEvidence: 'Customer confirmed the missed commitment by telephone.', escalationReason: 'Payment and custody blockers require one accountable recovery owner.' }
describe('coordinated meter follow-up', () => {
  it('hands both blocker streams to one owner and preserves prior ownership', () => { const next = coordinateMeterFollowUp(initialMeterWorkloadState, command); const meterCase = next.cases.find((item) => item.caseId === command.caseId); expect(meterCase).toMatchObject({ fieldOwner: 'Revenue recovery', customerOwner: 'Revenue recovery', contactAttempts: 4 }); expect(next.followUps[0]).toMatchObject({ previousFieldOwner: 'field-west', previousCustomerOwner: 'care-west', status: 'scheduled' }) })
  it('rejects viewer and stale coordination attempts', () => { expect(() => coordinateMeterFollowUp(initialMeterWorkloadState, { ...command, role: 'Operations Viewer' })).toThrow('supervisor'); expect(() => coordinateMeterFollowUp(initialMeterWorkloadState, { ...command, expectedRevision: 1 })).toThrow('changed') })
  it('keeps duplicate contact commands idempotent', () => { const next = coordinateMeterFollowUp(initialMeterWorkloadState, command); expect(coordinateMeterFollowUp(next, command)).toBe(next) })
})
