import { isStale, missingIntervals, type Reading } from './series';
export function TelemetryHealth({ readings }: {
    readings: Reading[];
}) {
    const latest = readings.at(-1);
    const first = readings[0];
    if (!latest || !first)
        return <div className="telemetry-health offline">No readings received</div>;
    const gaps = missingIntervals(readings, latest.meterId, first.at, latest.at);
    const stale = isStale(latest, '2027-03-15T10:00:00.000Z', 30);
    return <section className="telemetry-health"><div><i className={stale ? 'stale' : ''}/><span>INGEST STATUS</span><strong>{stale ? 'stale stream' : 'stream healthy'}</strong></div><div><span>LAST RECEIVED</span><strong>{latest.receivedAt.slice(11, 19)} UTC</strong></div><div><span>MISSING INTERVALS</span><strong>{gaps.length}</strong></div></section>;
}
