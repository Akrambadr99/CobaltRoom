export type PermitRole = 'Switching Author' | 'Safety Reviewer' | 'Control Operator' | 'Field Lead';
export interface SwitchingPermitState {
  revision: number;
  asset: { id: string; version: number; energized: boolean; activeDispatch: boolean; status: 'service' | 'isolated' | 'maintenance' };
  crew: { id: string; authorizationValidUntil: string; version: number; status: 'available' | 'working' };
  points: { id: string; sequence: number; position: 'closed' | 'open'; lockApplied: boolean; version: number }[];
  permit: null | { id: string; status: 'draft' | 'reviewed' | 'isolated' | 'issued' | 'work-complete' | 'closed'; assetVersion: number; crewVersion: number; pointVersions: Record<string, number>; author: string; reviewer?: string; operator?: string; fieldLead?: string };
  evidence: { id: string; kind: 'isolation' | 'lockout' | 'work-complete'; detail: string; immutable: true }[];
  events: { id: string; action: string; actor: string; detail: string }[];
}
export const initialSwitchingPermitState: SwitchingPermitState = { revision: 0, asset: { id: 'TX-204', version: 10, energized: true, activeDispatch: false, status: 'service' }, crew: { id: 'CREW-HV-3', authorizationValidUntil: '2027-01-31', version: 6, status: 'available' }, points: [{ id: 'SW-204-A', sequence: 1, position: 'closed', lockApplied: false, version: 5 }, { id: 'SW-204-B', sequence: 2, position: 'closed', lockApplied: false, version: 7 }], permit: null, evidence: [], events: [] };
interface Meta { id: string; expectedRevision: number; now: string; actor: { id: string; role: PermitRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: SwitchingPermitState, command: Meta) { assert(state.revision === command.expectedRevision, 'Switching permit changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: SwitchingPermitState, command: Meta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentPermit(state: SwitchingPermitState) { assert(state.permit, 'No switching permit exists.'); return state.permit; }
function assertCurrent(state: SwitchingPermitState) { const permit = currentPermit(state); assert(permit.assetVersion === state.asset.version, 'Asset changed after permit drafting.'); assert(permit.crewVersion === state.crew.version, 'Crew authorization changed after permit drafting.'); for (const point of state.points) assert(permit.pointVersions[point.id] === point.version, `${point.id} changed after permit drafting.`); }

export function draftPermit(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Switching Author', 'Only switching authors can draft permits.');
  const next = begin(state, command);
  assert(!next.permit && next.asset.energized && next.asset.status === 'service', 'In-service energized asset is required.');
  assert(!next.asset.activeDispatch, 'Active dispatch must be cleared before permit drafting.');
  assert(new Date(next.crew.authorizationValidUntil) >= new Date(command.now), 'Field crew authorization has expired.');
  next.permit = { id: `${command.id}-permit`, status: 'draft', assetVersion: next.asset.version, crewVersion: next.crew.version, pointVersions: Object.fromEntries(next.points.map((point) => [point.id, point.version])), author: command.actor.id };
  return finish(next, command, 'switching-permit-drafted', next.asset.id);
}

export function reviewSequence(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Safety Reviewer', 'Only safety reviewers can review switching.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'draft' && command.actor.id !== permit.author, 'Independent switching review is required.');
  assertCurrent(next);
  const sequences = next.points.map((point) => point.sequence);
  assert(new Set(sequences).size === sequences.length && Math.min(...sequences) === 1, 'Isolation sequence must be unique and start at one.');
  permit.status = 'reviewed'; permit.reviewer = command.actor.id;
  return finish(next, command, 'switching-sequence-reviewed', String(next.points.length));
}

export function isolateAsset(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Control Operator', 'Only control operators can isolate assets.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'reviewed', 'Reviewed switching permit is required.');
  assertCurrent(next);
  for (const point of next.points.toSorted((left, right) => left.sequence - right.sequence)) { point.position = 'open'; point.lockApplied = true; point.version += 1; permit.pointVersions[point.id] = point.version; next.evidence.push({ id: `${command.id}-${point.id}`, kind: 'isolation', detail: `${point.id}:open`, immutable: true }); next.evidence.push({ id: `${command.id}-${point.id}-lock`, kind: 'lockout', detail: `${point.id}:locked`, immutable: true }); }
  next.asset.energized = false; next.asset.status = 'isolated'; next.asset.version += 1; permit.assetVersion = next.asset.version; permit.status = 'isolated'; permit.operator = command.actor.id;
  return finish(next, command, 'asset-isolated-and-locked', next.asset.id);
}

export function issuePermit(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Field Lead' && command.actor.id === state.crew.id, 'Assigned field lead must accept the permit.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'isolated', 'Isolated asset is required for permit issue.');
  assertCurrent(next);
  assert(next.points.every((point) => point.position === 'open' && point.lockApplied), 'Every isolation point must be open and locked.');
  next.asset.status = 'maintenance'; next.asset.version += 1; next.crew.status = 'working'; next.crew.version += 1; permit.assetVersion = next.asset.version; permit.crewVersion = next.crew.version; permit.status = 'issued'; permit.fieldLead = command.actor.id;
  return finish(next, command, 'switching-permit-issued', next.crew.id);
}

export function completeWork(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Field Lead' && command.actor.id === state.crew.id, 'Assigned field lead must complete work.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'issued', 'Issued switching permit is required.');
  assertCurrent(next);
  next.evidence.push({ id: `${command.id}-completion`, kind: 'work-complete', detail: next.asset.id, immutable: true });
  next.crew.status = 'available'; next.crew.version += 1; permit.crewVersion = next.crew.version; permit.status = 'work-complete';
  return finish(next, command, 'field-work-completed', next.asset.id);
}

export function closeAndEnergize(state: SwitchingPermitState, command: Meta) {
  assert(command.actor.role === 'Control Operator', 'Only control operators can close permits.');
  const next = begin(state, command), permit = currentPermit(next);
  assert(permit.status === 'work-complete', 'Completed field work is required.');
  assertCurrent(next);
  assert(next.evidence.some((item) => item.kind === 'work-complete'), 'Immutable work-completion evidence is required.');
  for (const point of next.points.toSorted((left, right) => right.sequence - left.sequence)) { point.lockApplied = false; point.position = 'closed'; point.version += 1; permit.pointVersions[point.id] = point.version; }
  next.asset.energized = true; next.asset.status = 'service'; next.asset.version += 1; permit.assetVersion = next.asset.version; permit.status = 'closed';
  return finish(next, command, 'switching-permit-closed', next.asset.id);
}

export class SwitchingPermitRepository { static key = 'gridloom:switching-permits:v1'; private storage: Pick<Storage, 'getItem' | 'setItem'>; constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; } read() { const raw = this.storage.getItem(SwitchingPermitRepository.key); return raw ? JSON.parse(raw) as SwitchingPermitState : structuredClone(initialSwitchingPermitState); } commit(expectedRevision: number, operation: (state: SwitchingPermitState) => SwitchingPermitState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed switching. Refresh before retrying.'); const next = operation(current); this.storage.setItem(SwitchingPermitRepository.key, JSON.stringify(next)); return next; } }
