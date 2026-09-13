export type RestorationRole = 'Grid Controller' | 'Reliability Engineer' | 'Field Operator' | 'Shift Supervisor';

export interface RestorationState {
  revision: number;
  alarm: { id: string; status: 'contained' | 'cleared'; version: number };
  outage: { id: string; status: 'isolated' | 'restored'; version: number; affectedMw: number };
  telemetry: { version: number; capturedAt: string; voltageKv: number; frequencyHz: number; fresh: boolean };
  switches: { id: string; status: 'open' | 'closed'; order: number; version: number }[];
  dossier: {
    id: string;
    owner: string;
    status: 'draft' | 'engineered' | 'approved' | 'executing' | 'verified' | 'cancelled';
    alarmVersion: number;
    outageVersion: number;
    telemetryVersion: number;
    sequence: string[];
    completed: string[];
    engineer?: string;
    approver?: string;
  } | null;
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialRestorationState: RestorationState = {
  revision: 0,
  alarm: { id: 'ALARM-77', status: 'contained', version: 4 },
  outage: { id: 'OUTAGE-22', status: 'isolated', version: 6, affectedMw: 18 },
  telemetry: { version: 12, capturedAt: '2026-09-13T14:00:00Z', voltageKv: 11, frequencyHz: 50, fresh: true },
  switches: [
    { id: 'SW-14', status: 'open', order: 1, version: 3 },
    { id: 'SW-18', status: 'open', order: 2, version: 5 },
  ],
  dossier: null,
  events: [],
};

interface Meta {
  id: string;
  expectedRevision: number;
  actor: { id: string; role: RestorationRole };
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message);
}

function begin(state: RestorationState, command: Meta) {
  assert(state.revision === command.expectedRevision, 'Restoration dossier changed. Refresh before retrying.');
  assert(!state.events.some((event) => event.id === command.id), 'Command already applied.');
  return structuredClone(state);
}

function finish(state: RestorationState, command: Meta, action: string, detail: string) {
  state.revision += 1;
  state.events.push({ id: command.id, action, actor: command.actor.id, detail });
  return state;
}

function dossier(state: RestorationState) {
  const current = state.dossier;
  assert(current, 'Restoration dossier does not exist.');
  return current;
}

function assertNetworkVersions(state: RestorationState) {
  const current = dossier(state);
  assert(current.alarmVersion === state.alarm.version, 'Alarm state changed. Rebuild restoration evidence.');
  assert(current.outageVersion === state.outage.version, 'Outage state changed. Rebuild restoration evidence.');
}

export function openRestorationDossier(state: RestorationState, command: Meta) {
  assert(command.actor.role === 'Grid Controller', 'Only grid controllers can open restoration dossiers.');
  const next = begin(state, command);
  assert(next.alarm.status === 'contained', 'Alarm containment is required.');
  assert(next.outage.status === 'isolated', 'Outage must remain isolated.');
  assert(!next.dossier || ['verified', 'cancelled'].includes(next.dossier.status), 'An active restoration dossier exists.');
  next.dossier = {
    id: `${command.id}-restoration`,
    owner: command.actor.id,
    status: 'draft',
    alarmVersion: next.alarm.version,
    outageVersion: next.outage.version,
    telemetryVersion: next.telemetry.version,
    sequence: [],
    completed: [],
  };
  return finish(next, command, 'restoration-dossier-opened', next.outage.id);
}

export function engineerSequence(
  state: RestorationState,
  command: Meta & { switchIds: string[]; rationale: string },
) {
  assert(command.actor.role === 'Reliability Engineer', 'Only reliability engineering can design restoration.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'draft', 'Dossier is not awaiting engineering.');
  assertNetworkVersions(next);
  assert(command.actor.id !== current.owner, 'Restoration engineering must be independent.');
  assert(command.rationale.trim().length >= 20, 'Engineering rationale must contain at least 20 characters.');
  const unique = [...new Set(command.switchIds)];
  assert(unique.length === next.switches.length, 'Sequence must include each isolated switch exactly once.');
  const expected = [...next.switches].sort((a, b) => a.order - b.order).map((item) => item.id);
  assert(unique.every((id, index) => id === expected[index]), 'Switching sequence violates the engineered order.');
  current.sequence = unique;
  current.engineer = command.actor.id;
  current.status = 'engineered';
  return finish(next, command, 'restoration-sequence-engineered', unique.join(', '));
}

export function refreshRestorationTelemetry(
  state: RestorationState,
  command: Meta & { capturedAt: string; voltageKv: number; frequencyHz: number },
) {
  assert(command.actor.role === 'Reliability Engineer', 'Only reliability engineering can refresh telemetry.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(['engineered', 'approved', 'executing'].includes(current.status), 'Engineered restoration is required.');
  assert(command.capturedAt > next.telemetry.capturedAt, 'Telemetry sample must be newer than the current sample.');
  assert(command.voltageKv >= 10.5 && command.voltageKv <= 11.5, 'Voltage is outside the restoration band.');
  assert(command.frequencyHz >= 49.8 && command.frequencyHz <= 50.2, 'Frequency is outside the restoration band.');
  next.telemetry = {
    version: next.telemetry.version + 1,
    capturedAt: command.capturedAt,
    voltageKv: command.voltageKv,
    frequencyHz: command.frequencyHz,
    fresh: true,
  };
  current.telemetryVersion = next.telemetry.version;
  return finish(next, command, 'restoration-telemetry-refreshed', command.capturedAt);
}

export function approveRestoration(state: RestorationState, command: Meta) {
  assert(command.actor.role === 'Shift Supervisor', 'Only shift supervisors can approve restoration.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'engineered', 'Engineered sequence is required.');
  assertNetworkVersions(next);
  assert(current.engineer !== command.actor.id, 'Approval must be independent from engineering.');
  assert(current.telemetryVersion === next.telemetry.version && next.telemetry.fresh, 'Fresh pinned telemetry is required.');
  current.approver = command.actor.id;
  current.status = 'approved';
  return finish(next, command, 'restoration-approved', current.id);
}

export function executeNextSwitch(state: RestorationState, command: Meta) {
  assert(command.actor.role === 'Field Operator', 'Only field operators can execute switching.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(['approved', 'executing'].includes(current.status), 'Approved restoration is required.');
  assertNetworkVersions(next);
  assert(current.telemetryVersion === next.telemetry.version && next.telemetry.fresh, 'Telemetry changed before switching.');
  const switchId = current.sequence[current.completed.length];
  assert(switchId, 'All switching stages are complete.');
  const device = next.switches.find((item) => item.id === switchId);
  assert(device?.status === 'open', 'Next switch is not available for closure.');
  device.status = 'closed';
  device.version += 1;
  current.completed.push(device.id);
  current.status = 'executing';
  next.telemetry.fresh = false;
  return finish(next, command, 'restoration-stage-executed', device.id);
}

export function verifyRestoration(state: RestorationState, command: Meta) {
  assert(command.actor.role === 'Grid Controller', 'Only grid controllers can verify restoration.');
  const next = begin(state, command);
  const current = dossier(next);
  assert(current.status === 'executing', 'Executed switching is required.');
  assert(current.completed.length === current.sequence.length, 'Switching sequence is incomplete.');
  assert(next.switches.every((item) => item.status === 'closed'), 'All planned switches must be closed.');
  assert(next.telemetry.fresh && current.telemetryVersion === next.telemetry.version, 'Fresh post-switch telemetry is required.');
  next.outage.status = 'restored';
  next.outage.version += 1;
  next.alarm.status = 'cleared';
  next.alarm.version += 1;
  current.status = 'verified';
  return finish(next, command, 'restoration-verified', String(next.outage.affectedMw) + ' MW restored');
}

export class RestorationRepository {
  static key = 'gridloom:restoration-dossier:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) {
    this.storage = storage;
  }

  read() {
    const raw = this.storage.getItem(RestorationRepository.key);
    return raw ? JSON.parse(raw) as RestorationState : structuredClone(initialRestorationState);
  }

  commit(expectedRevision: number, change: (state: RestorationState) => RestorationState) {
    const current = this.read();
    assert(current.revision === expectedRevision, 'Another session changed restoration. Refresh before retrying.');
    const next = change(current);
    this.storage.setItem(RestorationRepository.key, JSON.stringify(next));
    return next;
  }
}
