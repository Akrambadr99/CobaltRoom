export type MeterOperatorDuty = 'custody' | 'certificate review' | 'closure'
export interface MeterOperator {
  id: string
  displayName: string
  active: boolean
  duties: MeterOperatorDuty[]
}
// These are product demonstration operator records, not external identity attestations.
export const meterOperators: MeterOperator[] = [
  { id: 'METER-CUSTODY', displayName: 'Operations assurance', active: true, duties: ['custody', 'closure'] },
  { id: 'METER-REVIEW', displayName: 'Independent disposal reviewer', active: true, duties: ['certificate review', 'closure'] },
  { id: 'METER-FIELD', displayName: 'Field custody operator', active: true, duties: ['custody'] },
  { id: 'METER-INACTIVE', displayName: 'Former meter operator', active: false, duties: ['custody'] },
]
export function requireMeterOperator(operators: MeterOperator[], operatorId: string, duty: MeterOperatorDuty,
  actor: string, businessOn: string, previousOn: string) {
  const matches = operators.filter((item) => item.id === operatorId)
  const operator = matches.length === 1 ? matches[0] : undefined
  if (!operator?.active || !operator.duties.includes(duty) || operator.displayName !== actor.trim()) {
    throw new Error('Selected meter operator is inactive, unknown or not authorized for this operation.')
  }
  const date = new Date(businessOn + 'T00:00:00Z')
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(businessOn) || !Number.isFinite(date.getTime())
    || date.toISOString().slice(0, 10) !== businessOn || businessOn < previousOn.slice(0, 10)) {
    throw new Error('A valid business date on or after prior custody evidence is required.')
  }
  return operator
}
