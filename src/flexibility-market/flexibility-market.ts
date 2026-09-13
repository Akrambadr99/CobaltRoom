export type FlexRole = 'Forecast Analyst' | 'Asset Controller' | 'Market Approver' | 'Dispatch Operator' | 'Settlement Reviewer';

export interface FlexibilityState {
  revision: number;
  forecast: { id: string; version: number; interval: string; shortfallMw: number; confidence: number };
  battery: { id: string; version: number; availableMw: number; stateOfCharge: number; reservedMw: number; status: 'available' | 'dispatched' };
  commitment: null | {
    id: string;
    status: 'draft' | 'reserved' | 'approved' | 'dispatched' | 'delivered' | 'settled';
    requestedMw: number;
    deliveredMw: number;
    forecastVersion: number;
    batteryVersion: number;
    owner: string;
    controller?: string;
    approver?: string;
    telemetryAt?: string;
  };
  settlement: null | { id: string; deliveredMwh: number; value: number; status: 'verified' };
  events: { id: string; action: string; actor: string; detail: string }[];
}

export const initialFlexibilityState: FlexibilityState = {
  revision: 0,
  forecast: { id: 'FCST-PEAK-41', version: 9, interval: '2026-10-08T17:00:00.000Z', shortfallMw: 3.5, confidence: 0.91 },
  battery: { id: 'BESS-ALPHA', version: 12, availableMw: 5, stateOfCharge: 78, reservedMw: 0, status: 'available' },
  commitment: null,
  settlement: null,
  events: [],
};

interface CommandMeta { id: string; expectedRevision: number; now: string; actor: { id: string; role: FlexRole } }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function begin(state: FlexibilityState, command: CommandMeta) { assert(state.revision === command.expectedRevision, 'Flexibility state changed. Refresh before retrying.'); assert(!state.events.some((event) => event.id === command.id), 'Command already applied.'); return structuredClone(state); }
function finish(state: FlexibilityState, command: CommandMeta, action: string, detail: string) { state.revision += 1; state.events.push({ id: command.id, action, actor: command.actor.id, detail }); return state; }
function currentCommitment(state: FlexibilityState) { assert(state.commitment, 'No flexibility commitment exists.'); return state.commitment; }
function assertEvidence(state: FlexibilityState) { const commitment = currentCommitment(state); assert(commitment.forecastVersion === state.forecast.version, 'Demand forecast changed after commitment creation.'); assert(commitment.batteryVersion === state.battery.version, 'Battery availability changed after commitment creation.'); }

export function draftCommitment(state: FlexibilityState, command: CommandMeta & { requestedMw: number }) {
  assert(command.actor.role === 'Forecast Analyst', 'Only forecast analysts can draft commitments.');
  const next = begin(state, command);
  assert(!next.commitment, 'An active flexibility commitment already exists.');
  assert(next.forecast.confidence >= 0.85, 'Forecast confidence is too low for a market commitment.');
  assert(command.requestedMw > 0 && command.requestedMw <= next.forecast.shortfallMw, 'Commitment must fit the forecast shortfall.');
  next.commitment = { id: `${command.id}-commitment`, status: 'draft', requestedMw: command.requestedMw, deliveredMw: 0, forecastVersion: next.forecast.version, batteryVersion: next.battery.version, owner: command.actor.id };
  return finish(next, command, 'flexibility-commitment-drafted', String(command.requestedMw));
}

export function reserveBattery(state: FlexibilityState, command: CommandMeta) {
  assert(command.actor.role === 'Asset Controller', 'Only asset controllers can reserve batteries.');
  const next = begin(state, command), commitment = currentCommitment(next);
  assert(commitment.status === 'draft' && command.actor.id !== commitment.owner, 'Independent asset reservation is required.');
  assertEvidence(next);
  assert(next.battery.stateOfCharge >= 60, 'Battery charge is below the flexibility threshold.');
  assert(next.battery.availableMw - next.battery.reservedMw >= commitment.requestedMw, 'Battery capacity is unavailable.');
  next.battery.reservedMw += commitment.requestedMw;
  next.battery.version += 1;
  commitment.batteryVersion = next.battery.version;
  commitment.status = 'reserved'; commitment.controller = command.actor.id;
  return finish(next, command, 'battery-capacity-reserved', next.battery.id);
}

export function approveMarketOffer(state: FlexibilityState, command: CommandMeta) {
  assert(command.actor.role === 'Market Approver', 'Only market approvers can approve offers.');
  const next = begin(state, command), commitment = currentCommitment(next);
  assert(commitment.status === 'reserved', 'Reserved commitment is required.');
  assert(command.actor.id !== commitment.owner && command.actor.id !== commitment.controller, 'Market approval must be independent.');
  assertEvidence(next);
  assert(new Date(next.forecast.interval).getTime() - new Date(command.now).getTime() >= 30 * 60 * 1000, 'Market gate closed before approval.');
  commitment.status = 'approved'; commitment.approver = command.actor.id;
  return finish(next, command, 'flexibility-offer-approved', commitment.id);
}

export function dispatchFlexibility(state: FlexibilityState, command: CommandMeta) {
  assert(command.actor.role === 'Dispatch Operator', 'Only dispatch operators can dispatch flexibility.');
  const next = begin(state, command), commitment = currentCommitment(next);
  assert(commitment.status === 'approved', 'Approved flexibility offer is required.');
  assertEvidence(next);
  next.battery.status = 'dispatched'; next.battery.version += 1;
  commitment.batteryVersion = next.battery.version; commitment.status = 'dispatched';
  return finish(next, command, 'flexibility-dispatched', next.forecast.interval);
}

export function recordDelivery(state: FlexibilityState, command: CommandMeta & { deliveredMw: number; telemetryAt: string }) {
  assert(command.actor.role === 'Dispatch Operator', 'Only dispatch operators can record delivery.');
  const next = begin(state, command), commitment = currentCommitment(next);
  assert(commitment.status === 'dispatched', 'Dispatched commitment is required.');
  assert(command.deliveredMw >= commitment.requestedMw * 0.95 && command.deliveredMw <= next.battery.availableMw, 'Delivered flexibility is outside tolerance.');
  assert(new Date(command.telemetryAt) >= new Date(next.forecast.interval), 'Delivery telemetry predates the committed interval.');
  commitment.deliveredMw = command.deliveredMw; commitment.telemetryAt = command.telemetryAt; commitment.status = 'delivered';
  next.battery.status = 'available'; next.battery.reservedMw -= commitment.requestedMw; next.battery.stateOfCharge -= 18; next.battery.version += 1; commitment.batteryVersion = next.battery.version;
  return finish(next, command, 'flexibility-delivery-recorded', String(command.deliveredMw));
}

export function verifySettlement(state: FlexibilityState, command: CommandMeta) {
  assert(command.actor.role === 'Settlement Reviewer', 'Only settlement reviewers can verify delivery.');
  const next = begin(state, command), commitment = currentCommitment(next);
  assert(commitment.status === 'delivered' && commitment.telemetryAt, 'Delivered commitment with telemetry is required.');
  assert(command.actor.id !== commitment.approver, 'Settlement review must be independent from market approval.');
  assert(!next.settlement, 'Flexibility settlement already exists.');
  const deliveredMwh = Math.round(commitment.deliveredMw * 0.5 * 100) / 100;
  next.settlement = { id: `${command.id}-settlement`, deliveredMwh, value: Math.round(deliveredMwh * 185 * 100) / 100, status: 'verified' };
  commitment.status = 'settled';
  return finish(next, command, 'flexibility-settlement-verified', String(deliveredMwh));
}

export class FlexibilityRepository {
  static key = 'gridloom:flexibility-market:v1';
  private storage: Pick<Storage, 'getItem' | 'setItem'>;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
  read() { const raw = this.storage.getItem(FlexibilityRepository.key); return raw ? JSON.parse(raw) as FlexibilityState : structuredClone(initialFlexibilityState); }
  commit(expectedRevision: number, operation: (state: FlexibilityState) => FlexibilityState) { const current = this.read(); assert(current.revision === expectedRevision, 'Another session changed flexibility. Refresh before retrying.'); const next = operation(current); this.storage.setItem(FlexibilityRepository.key, JSON.stringify(next)); return next; }
}
