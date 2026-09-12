export type GridRole = 'Dispatcher' | 'Field Operator' | 'Grid Controller' | 'Reliability Auditor';
export interface GridActor { id: string; role: GridRole }
export interface TelemetryWindow { assetId: string; observedAt: string; validUntil: string; megawatts: number; revision: number }
export interface GridAlarm { id: string; assetId: string; severity: 'warning' | 'critical'; status: 'open' | 'acknowledged' | 'escalated' | 'cleared'; owner?: string; dueAt: string; revision: number }
export interface RestorationPermit { id: string; assetId: string; requestedBy: string; telemetryRevision: number; status: 'requested' | 'approved' | 'rejected' | 'executed' | 'cancelled'; decision?: string; revision: number }
export interface GridEvent { id: string; action: string; actor: string; at: string; entityId: string; detail: string }
export interface ControlRoomState { revision: number; assets: Record<string, 'isolated' | 'ready' | 'online'>; telemetry: TelemetryWindow[]; alarms: GridAlarm[]; permits: RestorationPermit[]; events: GridEvent[] }
export const initialControlRoom: ControlRoomState = {
    revision: 0,
    assets: { 'battery-east': 'isolated' },
    telemetry: [{ assetId: 'battery-east', observedAt: '2026-09-13T08:00:00Z', validUntil: '2026-09-13T08:05:00Z', megawatts: 0, revision: 1 }],
    alarms: [{ id: 'alarm-east', assetId: 'battery-east', severity: 'critical', status: 'open', dueAt: '2026-09-13T08:10:00Z', revision: 1 }],
    permits: [], events: [],
};
interface Meta { id: string; expectedRevision: number; actor: GridActor; at: string }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
function begin(state: ControlRoomState, meta: Meta) {
    assert(state.revision === meta.expectedRevision, 'Control-room state changed. Refresh before retrying.');
    assert(meta.id.trim().length > 0 && Number.isFinite(Date.parse(meta.at)), 'Command identity and timestamp are required.');
    assert(!state.events.some(item => item.id === meta.id), 'Command identifier was already used.');
    return structuredClone(state);
}
function finish(state: ControlRoomState, meta: Meta, action: string, entityId: string, detail: string) {
    state.revision++; state.events.push({ id: meta.id, action, actor: meta.actor.id, at: meta.at, entityId, detail }); return state;
}
function latestTelemetry(state: ControlRoomState, assetId: string) {
    const samples = state.telemetry.filter(item => item.assetId === assetId).sort((a, b) => b.revision - a.revision);
    assert(samples[0], 'Telemetry is unavailable for this asset.'); return samples[0];
}
export function refreshTelemetry(state: ControlRoomState, command: Meta & { assetId: string; megawatts: number; validMinutes: number }) {
    assert(command.actor.role === 'Grid Controller', 'Only grid control can validate telemetry.');
    const next = begin(state, command), previous = latestTelemetry(next, command.assetId);
    assert(Number.isFinite(command.megawatts) && Math.abs(command.megawatts) <= 250, 'Telemetry exceeds the asset operating envelope.');
    assert(Number.isSafeInteger(command.validMinutes) && command.validMinutes >= 5 && command.validMinutes <= 30, 'Telemetry window must be 5 to 30 minutes.');
    assert(Date.parse(command.at) >= Date.parse(previous.observedAt), 'Telemetry cannot precede the latest sample.');
    next.telemetry.push({ assetId: command.assetId, observedAt: command.at,
        validUntil: new Date(Date.parse(command.at) + command.validMinutes * 60_000).toISOString(), megawatts: command.megawatts, revision: previous.revision + 1 });
    return finish(next, command, 'telemetry-refreshed', command.assetId, 'Valid for ' + String(command.validMinutes) + ' minutes');
}
export function acknowledgeAlarm(state: ControlRoomState, command: Meta & { alarmId: string }) {
    assert(command.actor.role === 'Grid Controller', 'Only grid control can acknowledge alarms.');
    const next = begin(state, command), alarm = next.alarms.find(item => item.id === command.alarmId);
    assert(alarm?.status === 'open', 'Alarm is no longer open.');
    alarm.status = 'acknowledged'; alarm.owner = command.actor.id; alarm.revision++;
    return finish(next, command, 'alarm-acknowledged', alarm.id, 'Alarm ownership accepted');
}
export function escalateOverdueAlarm(state: ControlRoomState, command: Meta & { alarmId: string; reason: string }) {
    assert(command.actor.role === 'Dispatcher', 'Only dispatch can escalate overdue alarms.');
    const next = begin(state, command), alarm = next.alarms.find(item => item.id === command.alarmId);
    assert(alarm && ['open', 'acknowledged'].includes(alarm.status), 'Alarm cannot be escalated from its current state.');
    assert(Date.parse(command.at) > Date.parse(alarm.dueAt), 'Alarm escalation is not due yet.');
    assert(command.reason.trim().length >= 20, 'Escalation reason must contain at least 20 characters.');
    alarm.status = 'escalated'; alarm.revision++;
    return finish(next, command, 'alarm-escalated', alarm.id, command.reason.trim());
}
export function clearAlarm(state: ControlRoomState, command: Meta & { alarmId: string; evidence: string }) {
    assert(command.actor.role === 'Grid Controller', 'Only grid control can clear alarms.');
    const next = begin(state, command), alarm = next.alarms.find(item => item.id === command.alarmId);
    assert(alarm && ['acknowledged', 'escalated'].includes(alarm.status), 'Acknowledge or escalate the alarm before clearing it.');
    assert(command.evidence.trim().length >= 20, 'Clearance evidence must contain at least 20 characters.');
    alarm.status = 'cleared'; alarm.revision++;
    return finish(next, command, 'alarm-cleared', alarm.id, command.evidence.trim());
}
export function requestRestoration(state: ControlRoomState, command: Meta & { assetId: string; rationale: string }) {
    assert(command.actor.role === 'Field Operator', 'Only field operations can request restoration.');
    const next = begin(state, command); assert(next.assets[command.assetId] === 'isolated', 'Asset is no longer isolated.');
    const telemetry = latestTelemetry(next, command.assetId);
    assert(Date.parse(telemetry.validUntil) >= Date.parse(command.at), 'Refresh stale telemetry before requesting restoration.');
    assert(!next.alarms.some(item => item.assetId === command.assetId && item.status !== 'cleared'), 'Clear active asset alarms before requesting restoration.');
    assert(!next.permits.some(item => item.assetId === command.assetId && ['requested', 'approved'].includes(item.status)), 'An active restoration permit already exists.');
    assert(command.rationale.trim().length >= 20, 'Restoration rationale must contain at least 20 characters.');
    const permit: RestorationPermit = { id: command.id + '-permit', assetId: command.assetId, requestedBy: command.actor.id,
        telemetryRevision: telemetry.revision, status: 'requested', revision: 1 };
    next.permits.push(permit); return finish(next, command, 'restoration-requested', permit.id, command.rationale.trim());
}
export function decideRestoration(state: ControlRoomState, command: Meta & { permitId: string; approve: boolean; rationale: string }) {
    assert(command.actor.role === 'Grid Controller', 'Only grid control can decide restoration.');
    const next = begin(state, command), permit = next.permits.find(item => item.id === command.permitId);
    assert(permit?.status === 'requested', 'Restoration permit is no longer awaiting a decision.');
    assert(permit.requestedBy !== command.actor.id, 'Restoration requires independent control approval.');
    assert(command.rationale.trim().length >= 20, 'Decision rationale must contain at least 20 characters.');
    permit.status = command.approve ? 'approved' : 'rejected'; permit.decision = command.rationale.trim(); permit.revision++;
    return finish(next, command, command.approve ? 'restoration-approved' : 'restoration-rejected', permit.id, permit.decision);
}
export function executeRestoration(state: ControlRoomState, command: Meta & { permitId: string }) {
    assert(command.actor.role === 'Field Operator', 'Only field operations can restore an asset.');
    const next = begin(state, command), permit = next.permits.find(item => item.id === command.permitId);
    assert(permit?.status === 'approved', 'Restoration permit is not approved.');
    const telemetry = latestTelemetry(next, permit.assetId);
    assert(telemetry.revision === permit.telemetryRevision && Date.parse(telemetry.validUntil) >= Date.parse(command.at), 'Telemetry changed or expired. Request a new restoration permit.');
    assert(!next.alarms.some(item => item.assetId === permit.assetId && item.status !== 'cleared'), 'A new active alarm blocks restoration.');
    next.assets[permit.assetId] = 'online'; permit.status = 'executed'; permit.revision++;
    return finish(next, command, 'restoration-executed', permit.id, 'Asset returned online');
}

export class ControlRoomRepository {
    static readonly key = 'gridloom:control-room:v1';
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;
    constructor(storage: Pick<Storage, 'getItem' | 'setItem'>) { this.storage = storage; }
    read(): ControlRoomState { const raw = this.storage.getItem(ControlRoomRepository.key); return raw ? JSON.parse(raw) as ControlRoomState : structuredClone(initialControlRoom); }
    commit(expected: number, change: (state: ControlRoomState) => ControlRoomState) {
        const current = this.read(); assert(current.revision === expected, 'Another session changed control-room state. Refresh before retrying.');
        const next = change(current); this.storage.setItem(ControlRoomRepository.key, JSON.stringify(next)); return next;
    }
}
