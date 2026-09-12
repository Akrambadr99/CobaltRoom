/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import { useMemo, useRef, useState } from 'react';
import { acknowledgeAlarm, clearAlarm, ControlRoomRepository, decideRestoration, escalateOverdueAlarm, executeRestoration, refreshTelemetry, requestRestoration, type ControlRoomState, type GridRole } from './control-room';

const actors: Record<GridRole, string> = { Dispatcher: 'dispatch-a', 'Field Operator': 'field-a', 'Grid Controller': 'controller-a', 'Reliability Auditor': 'audit-a' };
export function ControlRoomPage() {
    const repository = useMemo(() => new ControlRoomRepository(window.localStorage), []);
    const [state, setState] = useState<ControlRoomState>(() => repository.read());
    const [role, setRole] = useState<GridRole>('Grid Controller');
    const [notice, setNotice] = useState(''), [error, setError] = useState('');
    const feedback = useRef<HTMLParagraphElement>(null);
    const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role }, at: '2026-09-13T08:20:00Z' });
    const run = (change: (value: ControlRoomState) => ControlRoomState, message: string) => {
        try { const next = repository.commit(state.revision, change); setState(next); setNotice(message); setError(''); queueMicrotask(() => feedback.current?.focus()); }
        catch (failure) { setError(failure instanceof Error ? failure.message : 'Control-room action failed.'); setNotice(''); queueMicrotask(() => feedback.current?.focus()); }
    };
    const alarm = state.alarms[0], permit = state.permits.at(-1), telemetry = state.telemetry.at(-1);
    return <main className="page"><header className="page-title"><p>Grid-specific execution</p><h1>Telemetry, alarm and restoration control</h1><p>Fresh measurement windows and alarm state govern independently approved restoration.</p></header>
      <section className="workspace-toolbar" aria-label="Control-room actor"><label>Control role<select value={role} onChange={event => setRole(event.target.value as GridRole)}>{Object.keys(actors).map(item => <option key={item}>{item}</option>)}</select></label><button type="button" onClick={() => setState(repository.read())}>Refresh control room</button></section>
      {(notice || error) && <p ref={feedback} tabIndex={-1} role={error ? 'alert' : 'status'}>{error || notice}</p>}
      <div className="cards"><section className="card"><h2>Telemetry window</h2><p>{telemetry?.megawatts} MW · valid until {telemetry?.validUntil}</p><button type="button" disabled={role !== 'Grid Controller'} onClick={() => run(current => refreshTelemetry(current, { ...meta(), assetId: 'battery-east', megawatts: 0, validMinutes: 30 }), 'Telemetry refreshed.')}>Record fresh telemetry</button></section>
      <section className="card"><h2>Alarm escalation</h2><p>{alarm?.status} · due {alarm?.dueAt}</p><button type="button" disabled={role !== 'Grid Controller' || alarm?.status !== 'open'} onClick={() => run(current => acknowledgeAlarm(current, { ...meta(), alarmId: 'alarm-east' }), 'Alarm acknowledged.')}>Acknowledge critical alarm</button><button type="button" disabled={role !== 'Dispatcher' || !alarm || !['open', 'acknowledged'].includes(alarm.status)} onClick={() => run(current => escalateOverdueAlarm(current, { ...meta(), alarmId: 'alarm-east', reason: 'Field response has not reached the isolated asset.' }), 'Alarm escalated.')}>Escalate overdue alarm</button><button type="button" disabled={role !== 'Grid Controller' || !alarm || !['acknowledged', 'escalated'].includes(alarm.status)} onClick={() => run(current => clearAlarm(current, { ...meta(), alarmId: 'alarm-east', evidence: 'Telemetry and field isolation readings now agree.' }), 'Alarm cleared.')}>Clear alarm with evidence</button></section>
      <section className="card"><h2>Restoration permit</h2><p>Asset {state.assets['battery-east']} · permit {permit?.status ?? 'none'}</p><button type="button" disabled={role !== 'Field Operator' || Boolean(permit && ['requested', 'approved'].includes(permit.status))} onClick={() => run(current => requestRestoration(current, { ...meta(), assetId: 'battery-east', rationale: 'Isolation checks are complete and restoration is requested.' }), 'Restoration requested.')}>Request restoration</button><button type="button" disabled={role !== 'Grid Controller' || permit?.status !== 'requested'} onClick={() => run(current => decideRestoration(current, { ...meta(), permitId: permit?.id ?? '', approve: true, rationale: 'Control review confirms every restoration gate is clear.' }), 'Restoration approved.')}>Approve restoration</button><button type="button" disabled={role !== 'Field Operator' || permit?.status !== 'approved'} onClick={() => run(current => executeRestoration(current, { ...meta(), permitId: permit?.id ?? '' }), 'Asset restored.')}>Execute restoration</button></section></div>
      <section aria-label="Control-room history"><h2>Incident timeline</h2><ol>{state.events.toReversed().map(item => <li key={item.id}>{item.action} · {item.actor} · {item.detail}</li>)}</ol></section>
    </main>;
}
