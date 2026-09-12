/* eslint-disable react-refresh/only-export-components */
import { useState } from 'react';
import type { Entity, Snapshot } from '../../workspace/types';
export const recoverySteps = ['acknowledge', 'isolate', 'verify telemetry', 'restore'] as const;
export function advanceRecovery(completed: readonly string[], site: Entity | undefined, meters: Entity[]) {
    if (!site)
        return { completed, error: 'Select an energy site.' };
    const next = recoverySteps[completed.length];
    if (!next)
        return { completed, error: '' };
    if (next === 'verify telemetry' && (meters.length === 0 || meters.some((item) => item.status !== 'healthy')))
        return { completed, error: 'Every site meter must report healthy before verification.' };
    if (next === 'restore' && site.status === 'offline')
        return { completed, error: 'The site must be energized before service restoration.' };
    return { completed: [...completed, next], error: '' };
}
export function DomainLifecyclePanel({ snapshot }: { snapshot: Snapshot }) {
    const sites = snapshot.entities.filter((item) => item.kind === 'site');
    const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
    const [completed, setCompleted] = useState<readonly string[]>([]);
    const [error, setError] = useState('');
    const site = sites.find((item) => item.id === siteId);
    const meters = snapshot.entities.filter((item) => item.kind === 'meter' && item.fields['site'] === siteId);
    const next = recoverySteps[completed.length];
    const advance = () => { const result = advanceRecovery(completed, site, meters); setCompleted(result.completed); setError(result.error); };
    return <section className="sub" aria-label="Outage recovery sequence"><h3>Outage recovery sequence <span>{next ?? 'complete'}</span></h3><div className="filters"><select aria-label="Recovery site" value={siteId} onChange={(event) => { setSiteId(event.target.value); setCompleted([]); setError(''); }}>{sites.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select><button onClick={advance} disabled={!next}>Complete next step</button></div><p><b>{completed.length} of {recoverySteps.length} stages complete</b><small>{error || (next ? `Next: ${next}` : 'Recovery sequence completed in order.')}</small></p></section>;
}
