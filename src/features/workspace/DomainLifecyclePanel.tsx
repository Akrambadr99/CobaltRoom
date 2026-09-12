/* eslint-disable react-refresh/only-export-components */
import { product } from '../../product/definition';
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
export function DomainLifecyclePanel({ snapshot, actorId, onExecute }: { snapshot: Snapshot; actorId?: string; onExecute?: (operation: string, entityId: string) => void }) {
    const sites = snapshot.entities.filter(item => item.kind === 'site');
    const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
    const outages = snapshot.entities.filter(item => item.kind === 'outage' && item.fields['site'] === siteId);
    const [selectedOutage, setSelectedOutage] = useState('');
    const outage = outages.find(item => item.id === selectedOutage) ?? outages.find(item => item.status === 'open') ?? outages.at(-1);
    const recovery = snapshot.entities.find(item => item.kind === 'recovery' && item.fields['outage'] === outage?.id);
    const stage = recovery?.status ?? 'not acknowledged';
    const action = !recovery ? 'acknowledge-recovery' : stage === 'acknowledged' ? 'island' : stage === 'verified' ? 'restore' : stage === 'complete' ? '' : 'verify-recovery';
    const operation = product.operations.find(item => item.key === action);
    const role = product.actors.find(item => item.id === actorId)?.role ?? '';
    const meters = snapshot.entities.filter(item => item.kind === 'meter' && item.fields['site'] === siteId);
    const batteryIds = new Set(snapshot.entities.filter(item => item.kind === 'battery' && item.fields['site'] === siteId).map(item => item.id));
    const activeDispatches = snapshot.entities.filter(item => item.kind === 'dispatch' && item.status === 'active' && batteryIds.has(String(item.fields['battery'])));
    return <section className="sub" aria-label="Outage recovery sequence"><h3>Outage recovery sequence <span>{stage}</span></h3>
        <label>Recovery site<select value={siteId} onChange={event => { setSiteId(event.target.value); setSelectedOutage(''); }}>{sites.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label>Recovery outage<select value={outage?.id ?? ''} onChange={event => { setSelectedOutage(event.target.value); }}>{outages.map(item => <option key={item.id} value={item.id}>{item.title} - {item.status}</option>)}</select></label>
        <p>{outage ? String(recovery?.fields['result'] ?? 'Acknowledge this outage to begin recovery.') : 'Create an outage record to begin recovery.'}</p>
        {outage && operation && operation.roles.includes(role) && <button onClick={() => onExecute?.(action, action === 'verify-recovery' ? recovery?.id ?? '' : outage.id)}>Run: {operation.label}</button>}
        {recovery && stage === 'verified' && role === 'Reliability Engineer' && <button onClick={() => onExecute?.('verify-recovery', recovery.id)}>Run: Verify recovery telemetry</button>}
        {role === 'Energy Operator' && meters.map(meter => <button key={meter.id} onClick={() => onExecute?.('refresh-meter', meter.id)}>Refresh telemetry: {meter.title}</button>)}
        {role === 'Grid Controller' && activeDispatches.map(dispatch => <button key={dispatch.id} onClick={() => onExecute?.('stop-dispatch', dispatch.id)}>Stop dispatch: {dispatch.title}</button>)}
    </section>;
}
