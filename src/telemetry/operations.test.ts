import { describe, expect, it } from 'vitest'
import { estimatedRuntimeHours, validateBatteryDispatch } from './battery'
import { forecastVariance, meanAbsolutePercentageError } from './forecasts'
import { customerMinutesInterrupted, mergeOutages, outageMinutes, type Outage } from './outages'

describe('battery operating envelope', () => {
  const limits = { minimumSoc: 20, maximumSoc: 95, maximumChargeKw: 200, maximumDischargeKw: 250 }
  it('reports independent state and inverter limit violations', () => {
    expect(validateBatteryDispatch({ at: '2027-03-15T10:00:00Z', powerKw: -240, stateOfCharge: 12 }, limits)).toEqual(['State of charge is below the operating reserve.', 'Charge request exceeds inverter capability.'])
    expect(validateBatteryDispatch({ at: '2027-03-15T10:00:00Z', powerKw: 280, stateOfCharge: 99 }, limits)).toEqual(['State of charge exceeds the configured ceiling.', 'Discharge request exceeds inverter capability.'])
    expect(validateBatteryDispatch({ at: '2027-03-15T10:00:00Z', powerKw: 100, stateOfCharge: 60 }, limits)).toEqual([])
    expect(estimatedRuntimeHours(60, 500, 100)).toBe(3)
    expect(estimatedRuntimeHours(60, 500, 0)).toBeNull()
  })
})

describe('forecast and reliability analytics', () => {
  const forecast = [
    { at: 't1', expectedKwh: 100, lowerKwh: 80, upperKwh: 120 },
    { at: 't2', expectedKwh: 90, lowerKwh: 70, upperKwh: 110 },
    { at: 'missing', expectedKwh: 50, lowerKwh: 40, upperKwh: 60 },
  ]
  it('joins intervals and identifies confidence-band misses', () => {
    expect(forecastVariance(forecast, [{ at: 't1', actualKwh: 125 }, { at: 't2', actualKwh: 100 }])).toEqual([
      { at: 't1', expectedKwh: 100, actualKwh: 125, varianceKwh: 25, outsideBand: true },
      { at: 't2', expectedKwh: 90, actualKwh: 100, varianceKwh: 10, outsideBand: false },
    ])
    expect(meanAbsolutePercentageError(forecast, [{ at: 't1', actualKwh: 125 }, { at: 't2', actualKwh: 100 }])).toBe(15)
    expect(meanAbsolutePercentageError(forecast, [{ at: 't1', actualKwh: 0 }])).toBe(0)
  })
  it('merges overlapping outages and derives customer interruption minutes', () => {
    const outages: Outage[] = [
      { id: 'o1', siteId: 'north', startedAt: '2027-03-15T07:00:00Z', restoredAt: '2027-03-15T08:00:00Z', affectedMeters: ['m1'], cause: 'grid' },
      { id: 'o2', siteId: 'north', startedAt: '2027-03-15T07:45:00Z', restoredAt: '2027-03-15T08:30:00Z', affectedMeters: ['m1', 'm2'], cause: 'grid' },
      { id: 'o3', siteId: 'south', startedAt: '2027-03-15T09:00:00Z', affectedMeters: ['m3'], cause: 'asset' },
    ]
    const merged = mergeOutages(outages)
    expect(merged).toHaveLength(2)
    expect(merged[0]).toMatchObject({ restoredAt: '2027-03-15T08:30:00Z', affectedMeters: ['m1', 'm2'] })
    expect(outageMinutes(outages[2]!, '2027-03-15T10:00:00Z')).toBe(60)
    expect(customerMinutesInterrupted(merged, '2027-03-15T10:00:00Z')).toBe(240)
  })
})
