export type TransformerRole = 'Field Technician' | 'Laboratory Analyst' | 'Asset Engineer' | 'Control Operator' | 'Maintenance Crew' | 'Reliability Auditor';

export interface TransformerConditionState {
  revision: number;
  transformer: {
    id: string;
    version: number;
    status: 'service' | 'isolated';
    oilBatch: string;
    dissolvedGasPpm: number;
  };
  feeder: {
    id: string;
    version: number;
    status: 'normal' | 'transferred';
    loadMw: number;
    reserveCapacityMw: number;
  };
  telemetry: {
    version: number;
    temperatureC: number;
    sampledAt: string;
  };
  case: null | {
    id: string;
    status: 'sampled' | 'critical' | 'approved' | 'isolated' | 'serviced' | 'verified' | 'closed';
    transformerVersion: number;
    feederVersion: number;
    telemetryVersion: number;
    sampleSeal: string;
    sampleGasPpm?: number;
    owner: string;
    analyst?: string;
    engineer?: string;
    crew?: string;
    auditor?: string;
  };
  custody: {
    id: string;
    sampleSeal: string;
    from: string;
    to: string;
    immutable: true;
  }[];
  evidence: {
    id: string;
    kind: 'analysis' | 'maintenance' | 'verification';
    detail: string;
    immutable: true;
  }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialTransformerConditionState: TransformerConditionState = {
  revision: 0,
  transformer: { id: 'TX-811', version: 13, status: 'service', oilBatch: 'OIL-OLD-17', dissolvedGasPpm: 880 },
  feeder: { id: 'FEEDER-E8', version: 10, status: 'normal', loadMw: 12, reserveCapacityMw: 15 },
  telemetry: { version: 31, temperatureC: 86, sampledAt: '2026-09-13T06:00:00Z' },
  case: null,
  custody: [],
  evidence: [],
  events: [],
};

interface Meta {
  id: string;
  expectedRevision: number;
  actor: { id: string; role: TransformerRole };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: TransformerConditionState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Transformer condition changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: TransformerConditionState, command: Meta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function current(state: TransformerConditionState) {
  assert(state.case, 'No transformer condition case exists.');
  return state.case;
}

function assertCurrent(state: TransformerConditionState) {
  const item = current(state);
  assert(item.transformerVersion === state.transformer.version, 'Transformer changed after condition sampling.');
  assert(item.feederVersion === state.feeder.version, 'Feeder changed after condition sampling.');
  assert(item.telemetryVersion === state.telemetry.version, 'Condition telemetry changed after sampling.');
}

export function collectTransformerSample(state: TransformerConditionState, command: Meta & { sampleSeal: string }) {
  assert(command.actor.role === 'Field Technician', 'Only field technicians can collect transformer samples.');
  const next = begin(state, command);
  assert(!next.case && next.transformer.status === 'service', 'In-service transformer without an open case is required.');
  assert(/^SEAL-[A-Z0-9]{8}$/.test(command.sampleSeal), 'Sample seal must use SEAL-XXXXXXXX format.');
  assert(next.telemetry.temperatureC >= 80, 'Condition telemetry does not require an oil sample.');
  next.case = {
    id: `${command.id}-case`,
    status: 'sampled',
    transformerVersion: next.transformer.version,
    feederVersion: next.feeder.version,
    telemetryVersion: next.telemetry.version,
    sampleSeal: command.sampleSeal,
    owner: command.actor.id,
  };
  next.custody.push({ id: `${command.id}-custody`, sampleSeal: command.sampleSeal, from: next.transformer.id, to: 'GRID-LAB', immutable: true });
  return finish(next, command, 'transformer-sample-collected', command.sampleSeal);
}

export function analyzeTransformerSample(state: TransformerConditionState, command: Meta & { sampleSeal: string; dissolvedGasPpm: number }) {
  assert(command.actor.role === 'Laboratory Analyst', 'Only laboratory analysts can analyze transformer samples.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'sampled' && command.actor.id !== item.owner, 'Independent sealed sample is required.');
  assertCurrent(next);
  assert(command.sampleSeal === item.sampleSeal && next.custody.some((entry) => entry.sampleSeal === command.sampleSeal && entry.to === 'GRID-LAB'), 'Sample custody does not match the submitted analysis.');
  assert(Number.isInteger(command.dissolvedGasPpm) && command.dissolvedGasPpm >= 500, 'Laboratory result does not meet the critical maintenance threshold.');
  item.sampleGasPpm = command.dissolvedGasPpm;
  item.status = 'critical';
  item.analyst = command.actor.id;
  next.evidence.push({ id: `${command.id}-analysis`, kind: 'analysis', detail: `${command.sampleSeal}:${String(command.dissolvedGasPpm)}`, immutable: true });
  return finish(next, command, 'transformer-sample-analyzed', String(command.dissolvedGasPpm));
}

export function approveTransformerMaintenance(state: TransformerConditionState, command: Meta) {
  assert(command.actor.role === 'Asset Engineer', 'Only asset engineers can approve transformer maintenance.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'critical' && command.actor.id !== item.owner && command.actor.id !== item.analyst, 'Independent critical condition case is required.');
  assertCurrent(next);
  assert(typeof item.sampleGasPpm === 'number' && item.sampleGasPpm >= 500, 'Critical laboratory result is required.');
  assert(next.feeder.reserveCapacityMw >= next.feeder.loadMw, 'Feeder reserve cannot carry transferred load.');
  item.status = 'approved';
  item.engineer = command.actor.id;
  return finish(next, command, 'transformer-maintenance-approved', next.transformer.id);
}

export function isolateConditionTransformer(state: TransformerConditionState, command: Meta) {
  assert(command.actor.role === 'Control Operator', 'Only control operators can isolate transformers.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'approved', 'Approved transformer maintenance is required.');
  assertCurrent(next);
  assert(next.feeder.status === 'normal' && next.feeder.reserveCapacityMw >= next.feeder.loadMw, 'Current reserve capacity is required for load transfer.');
  next.feeder.status = 'transferred';
  next.feeder.version += 1;
  item.feederVersion = next.feeder.version;
  next.transformer.status = 'isolated';
  next.transformer.version += 1;
  item.transformerVersion = next.transformer.version;
  item.status = 'isolated';
  return finish(next, command, 'condition-transformer-isolated', next.feeder.id);
}

export function serviceTransformerOil(state: TransformerConditionState, command: Meta & { replacementBatch: string }) {
  assert(command.actor.role === 'Maintenance Crew', 'Only maintenance crews can service transformer oil.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'isolated' && next.transformer.status === 'isolated', 'Isolated transformer is required for oil service.');
  assertCurrent(next);
  assert(/^OIL-NEW-\d{2}$/.test(command.replacementBatch) && command.replacementBatch !== next.transformer.oilBatch, 'New traceable replacement oil batch is required.');
  next.transformer.oilBatch = command.replacementBatch;
  next.transformer.version += 1;
  item.transformerVersion = next.transformer.version;
  item.status = 'serviced';
  item.crew = command.actor.id;
  next.evidence.push({ id: `${command.id}-maintenance`, kind: 'maintenance', detail: command.replacementBatch, immutable: true });
  return finish(next, command, 'transformer-oil-serviced', command.replacementBatch);
}

export function verifyTransformerRecovery(state: TransformerConditionState, command: Meta & { dissolvedGasPpm: number; sampledAt: string }) {
  assert(command.actor.role === 'Reliability Auditor', 'Only reliability auditors can verify transformer recovery.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'serviced' && command.actor.id !== item.crew && command.actor.id !== item.engineer, 'Independent serviced transformer is required.');
  assertCurrent(next);
  assert(Number.isInteger(command.dissolvedGasPpm) && command.dissolvedGasPpm <= 200, 'Fresh dissolved-gas result is not within release limits.');
  assert(Date.parse(command.sampledAt) > Date.parse(next.telemetry.sampledAt), 'Recovery telemetry must be newer than the triggering sample.');
  next.transformer.dissolvedGasPpm = command.dissolvedGasPpm;
  next.transformer.version += 1;
  item.transformerVersion = next.transformer.version;
  next.telemetry.temperatureC = 62;
  next.telemetry.sampledAt = command.sampledAt;
  next.telemetry.version += 1;
  item.telemetryVersion = next.telemetry.version;
  item.status = 'verified';
  item.auditor = command.actor.id;
  next.evidence.push({ id: `${command.id}-verification`, kind: 'verification', detail: `${String(command.dissolvedGasPpm)}:${command.sampledAt}`, immutable: true });
  return finish(next, command, 'transformer-recovery-verified', String(command.dissolvedGasPpm));
}

export function restoreConditionTransformer(state: TransformerConditionState, command: Meta) {
  assert(command.actor.role === 'Control Operator', 'Only control operators can restore transformers.');
  const next = begin(state, command), item = current(next);
  assert(item.status === 'verified' && next.transformer.status === 'isolated' && next.feeder.status === 'transferred', 'Verified isolated transformer with transferred load is required.');
  assertCurrent(next);
  assert(next.transformer.dissolvedGasPpm <= 200 && next.telemetry.temperatureC <= 70, 'Current condition evidence does not support restoration.');
  next.transformer.status = 'service';
  next.transformer.version += 1;
  item.transformerVersion = next.transformer.version;
  next.feeder.status = 'normal';
  next.feeder.version += 1;
  item.feederVersion = next.feeder.version;
  item.status = 'closed';
  return finish(next, command, 'condition-transformer-restored', next.transformer.id);
}

export class TransformerConditionRepository {
  static key = 'gridloom:transformer-condition:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(TransformerConditionRepository.key); return raw ? JSON.parse(raw) as TransformerConditionState : structuredClone(initialTransformerConditionState); }
  commit(expectedRevision: number, operation: (state: TransformerConditionState) => TransformerConditionState) { const state = this.read(); assert(state.revision === expectedRevision, 'Another session changed transformer condition. Refresh before retrying.'); const next = operation(state); this.storage.setItem(TransformerConditionRepository.key, JSON.stringify(next)); return next; }
}
