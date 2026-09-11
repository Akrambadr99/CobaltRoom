export interface Outage { id: string; siteId: string; startedAt: string; restoredAt?: string; affectedMeters: string[]; cause: 'grid' | 'asset' | 'planned' | 'unknown' }
export function outageMinutes(outage: Outage, asOf: string): number { return Math.max(0, Math.round((new Date(outage.restoredAt ?? asOf).getTime() - new Date(outage.startedAt).getTime()) / 60_000)) }
export function customerMinutesInterrupted(outages: Outage[], asOf: string): number { return outages.reduce((sum, outage) => sum + outageMinutes(outage, asOf) * outage.affectedMeters.length, 0) }
export function mergeOutages(outages: Outage[]): Outage[] {
  const result: Outage[] = []
  for (const outage of [...outages].sort((a, b) => a.startedAt.localeCompare(b.startedAt))) {
    const current = result.at(-1)
    if (current?.siteId === outage.siteId && current.cause === outage.cause && (current.restoredAt ?? '9999') >= outage.startedAt) {
      const restoredAt = [current.restoredAt, outage.restoredAt].filter((value): value is string => value !== undefined).sort().at(-1)
      if (restoredAt) current.restoredAt = restoredAt
      current.affectedMeters = [...new Set([...current.affectedMeters, ...outage.affectedMeters])]
    } else result.push({ ...outage, affectedMeters: [...outage.affectedMeters] })
  }
  return result
}
