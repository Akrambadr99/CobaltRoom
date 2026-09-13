import { useRef, useState } from 'react';
import {
  approveRestoration,
  engineerSequence,
  executeNextSwitch,
  openRestorationDossier,
  refreshRestorationTelemetry,
  RestorationRepository,
  verifyRestoration,
  type RestorationRole,
  type RestorationState,
} from './restoration-dossier';

const actorIds: Record<RestorationRole, string> = {
  'Grid Controller': 'controller',
  'Reliability Engineer': 'reliability',
  'Field Operator': 'field',
  'Shift Supervisor': 'supervisor',
};

export function RestorationDossierPage() {
  const [repository] = useState(() => new RestorationRepository(localStorage));
  const [state, setState] = useState<RestorationState>(() => repository.read());
  const [role, setRole] = useState<RestorationRole>('Grid Controller');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const current = state.dossier;

  const command = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actorIds[role], role } });
  const run = (change: (value: RestorationState) => RestorationState, success: string) => {
    try {
      setState(repository.commit(state.revision, change));
      setMessage(success);
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Restoration action failed.');
    }
    queueMicrotask(() => feedback.current?.focus());
  };

  const nextTelemetryTime = `2026-09-13T14:${String(5 + state.telemetry.version - 12).padStart(2, '0')}:00Z`;

  return <main className="page">
    <header className="page-title">
      <p>Network restoration assurance</p>
      <h1>Restoration authorization dossier</h1>
      <p>Contained alarms, outage isolation, engineered switching and fresh telemetry form one recovery record.</p>
    </header>
    <section className="workspace-toolbar">
      <label>Restoration role<select value={role} onChange={(event) => { setRole(event.target.value as RestorationRole); }}>{Object.keys(actorIds).map((item) => <option key={item}>{item}</option>)}</select></label>
      <button onClick={() => { setState(repository.read()); }}>Refresh restoration dossier</button>
    </section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <div className="cards">
      <section className="card">
        <h2>Outage {state.outage.id}</h2>
        <p>{state.outage.status} · alarm {state.alarm.status} · {state.outage.affectedMw} MW affected</p>
        <p>Dossier {current?.status ?? 'not opened'} · {current?.completed.length ?? 0} of {current?.sequence.length ?? 0} stages</p>
        <button disabled={role !== 'Grid Controller' || Boolean(current && !['verified', 'cancelled'].includes(current.status))} onClick={() => { run((value) => openRestorationDossier(value, command()), 'Restoration dossier opened.'); }}>Open restoration dossier</button>
        <button disabled={role !== 'Reliability Engineer' || current?.status !== 'draft'} onClick={() => { run((value) => engineerSequence(value, { ...command(), switchIds: ['SW-14', 'SW-18'], rationale: 'Sequence restores the bus while preserving protection coordination.' }), 'Switching sequence engineered.'); }}>Engineer switching sequence</button>
        <button disabled={role !== 'Reliability Engineer' || !current || !['engineered', 'approved', 'executing'].includes(current.status)} onClick={() => { run((value) => refreshRestorationTelemetry(value, { ...command(), capturedAt: nextTelemetryTime, voltageKv: 11, frequencyHz: 50 }), 'Restoration telemetry refreshed.'); }}>Refresh restoration telemetry</button>
      </section>
      <section className="card">
        <h2>Switching execution</h2>
        <p>Telemetry version {state.telemetry.version} · {state.telemetry.fresh ? 'fresh' : 'refresh required'}</p>
        <p>{state.switches.map((item) => item.id + ' ' + item.status).join(' · ')}</p>
        <button disabled={role !== 'Shift Supervisor' || current?.status !== 'engineered'} onClick={() => { run((value) => approveRestoration(value, command()), 'Restoration approved.'); }}>Approve restoration</button>
        <button disabled={role !== 'Field Operator' || !current || !['approved', 'executing'].includes(current.status) || !state.telemetry.fresh} onClick={() => { run((value) => executeNextSwitch(value, command()), 'Next switching stage executed.'); }}>Execute next switching stage</button>
        <button disabled={role !== 'Grid Controller' || current?.status !== 'executing' || current.completed.length !== current.sequence.length || !state.telemetry.fresh} onClick={() => { run((value) => verifyRestoration(value, command()), 'Network restoration verified.'); }}>Verify network restoration</button>
      </section>
    </div>
    <section aria-label="Restoration dossier history"><h2>Restoration dossier history</h2><ol>{state.events.toReversed().map((event) => <li key={event.id}>{event.action} · {event.actor} · {event.detail}</li>)}</ol></section>
  </main>;
}
