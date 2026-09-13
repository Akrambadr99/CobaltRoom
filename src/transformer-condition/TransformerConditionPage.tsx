import { useRef, useState } from 'react';
import { analyzeTransformerSample, approveTransformerMaintenance, collectTransformerSample, isolateConditionTransformer, restoreConditionTransformer, serviceTransformerOil, TransformerConditionRepository, verifyTransformerRecovery, type TransformerConditionState, type TransformerRole } from './transformer-condition';

const actors: Record<TransformerRole, string> = { 'Field Technician': 'field-technician', 'Laboratory Analyst': 'lab-analyst', 'Asset Engineer': 'asset-engineer', 'Control Operator': 'control-operator', 'Maintenance Crew': 'maintenance-crew', 'Reliability Auditor': 'reliability-auditor' };

export function TransformerConditionPage() {
  const [repository] = useState(() => new TransformerConditionRepository(localStorage));
  const [state, setState] = useState<TransformerConditionState>(() => repository.read());
  const [role, setRole] = useState<TransformerRole>('Field Technician');
  const [message, setMessage] = useState('');
  const feedback = useRef<HTMLParagraphElement>(null);
  const meta = () => ({ id: crypto.randomUUID(), expectedRevision: state.revision, actor: { id: actors[role], role } });
  const run = (operation: (value: TransformerConditionState) => TransformerConditionState, success: string) => {
    try { setState(repository.commit(state.revision, operation)); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Transformer condition action failed.'); }
    queueMicrotask(() => feedback.current?.focus());
  };
  return <main className="page">
    <header className="page-title"><p>Asset health</p><h1>Transformer condition</h1><p>Preserve oil-sample custody, transfer feeder load and restore only from fresh condition evidence.</p></header>
    <section className="workspace-toolbar"><label>Transformer role<select value={role} onChange={(event) => { setRole(event.target.value as TransformerRole); }}>{Object.keys(actors).map((item) => <option key={item}>{item}</option>)}</select></label><button onClick={() => { setState(repository.read()); setMessage('Transformer condition refreshed.'); }}>Refresh transformer condition</button></section>
    {message && <p ref={feedback} tabIndex={-1} role="status">{message}</p>}
    <section className="card">
      <h2>{state.transformer.id} · {state.case?.status ?? 'not sampled'}</h2>
      <p>Transformer {state.transformer.status} · oil {state.transformer.oilBatch} · gas {state.transformer.dissolvedGasPpm}ppm</p>
      <p>Feeder {state.feeder.status} · load {state.feeder.loadMw}MW · reserve {state.feeder.reserveCapacityMw}MW</p>
      <p>Temperature {state.telemetry.temperatureC}°C · custody {state.custody.length} · evidence {state.evidence.length}</p>
      <button disabled={role !== 'Field Technician' || Boolean(state.case)} onClick={() => { run((value) => collectTransformerSample(value, { ...meta(), sampleSeal: 'SEAL-A1B2C3D4' }), 'Transformer sample collected.'); }}>Collect transformer sample</button>
      <button disabled={role !== 'Laboratory Analyst' || state.case?.status !== 'sampled'} onClick={() => { run((value) => analyzeTransformerSample(value, { ...meta(), sampleSeal: 'SEAL-A1B2C3D4', dissolvedGasPpm: 920 }), 'Transformer sample analyzed.'); }}>Analyze transformer sample</button>
      <button disabled={role !== 'Asset Engineer' || state.case?.status !== 'critical'} onClick={() => { run((value) => approveTransformerMaintenance(value, meta()), 'Transformer maintenance approved.'); }}>Approve transformer maintenance</button>
      <button disabled={role !== 'Control Operator' || state.case?.status !== 'approved'} onClick={() => { run((value) => isolateConditionTransformer(value, meta()), 'Condition transformer isolated.'); }}>Isolate condition transformer</button>
      <button disabled={role !== 'Maintenance Crew' || state.case?.status !== 'isolated'} onClick={() => { run((value) => serviceTransformerOil(value, { ...meta(), replacementBatch: 'OIL-NEW-42' }), 'Transformer oil serviced.'); }}>Service transformer oil</button>
      <button disabled={role !== 'Reliability Auditor' || state.case?.status !== 'serviced'} onClick={() => { run((value) => verifyTransformerRecovery(value, { ...meta(), dissolvedGasPpm: 140, sampledAt: '2026-09-14T09:00:00Z' }), 'Transformer recovery verified.'); }}>Verify transformer recovery</button>
      <button disabled={role !== 'Control Operator' || state.case?.status !== 'verified'} onClick={() => { run((value) => restoreConditionTransformer(value, meta()), 'Condition transformer restored.'); }}>Restore condition transformer</button>
    </section>
    <section className="card" aria-label="Transformer condition history"><h2>Condition history</h2>{state.events.map((event) => <p key={event.id}>{event.action} · {event.detail}</p>)}</section>
  </main>;
}
