export interface BatterySample { at: string; powerKw: number; stateOfCharge: number }
export interface BatteryLimits { minimumSoc: number; maximumSoc: number; maximumChargeKw: number; maximumDischargeKw: number }

export function validateBatteryDispatch(sample: BatterySample, limits: BatteryLimits): string[] {
  const issues: string[] = []
  if (sample.stateOfCharge < limits.minimumSoc) issues.push('State of charge is below the operating reserve.')
  if (sample.stateOfCharge > limits.maximumSoc) issues.push('State of charge exceeds the configured ceiling.')
  if (sample.powerKw < -limits.maximumChargeKw) issues.push('Charge request exceeds inverter capability.')
  if (sample.powerKw > limits.maximumDischargeKw) issues.push('Discharge request exceeds inverter capability.')
  return issues
}

export function estimatedRuntimeHours(stateOfCharge: number, capacityKwh: number, dischargeKw: number): number | null {
  if (dischargeKw <= 0) return null
  return Math.round(stateOfCharge / 100 * capacityKwh / dischargeKw * 10) / 10
}
