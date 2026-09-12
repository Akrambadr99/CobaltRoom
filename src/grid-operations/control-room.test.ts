import { describe, expect, it } from 'vitest';
import { acknowledgeAlarm, clearAlarm, decideRestoration, escalateOverdueAlarm, executeRestoration, initialControlRoom, refreshTelemetry, requestRestoration } from './control-room';
const meta = (id: string, revision: number, actorId: string, role: 'Dispatcher' | 'Field Operator' | 'Grid Controller' | 'Reliability Auditor', at = '2026-09-13T08:20:00Z') => ({ id, expectedRevision: revision, actor: { id: actorId, role }, at });
describe('control room workflows', () => {
    it('creates bounded ordered telemetry windows', () => {
        const next = refreshTelemetry(initialControlRoom, { ...meta('t1', 0, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 30, validMinutes: 10 });
        expect(next.telemetry.at(-1)).toMatchObject({ megawatts: 30, revision: 2, validUntil: '2026-09-13T08:30:00.000Z' });
        expect(() => refreshTelemetry(next, { ...meta('t2', 1, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 300, validMinutes: 10 })).toThrow('envelope');
    });
    it('acknowledges and escalates only overdue alarms', () => {
        const acknowledged = acknowledgeAlarm(initialControlRoom, { ...meta('a1', 0, 'controller', 'Grid Controller'), alarmId: 'alarm-east' });
        expect(() => escalateOverdueAlarm(acknowledged, { ...meta('a2', 1, 'dispatch', 'Dispatcher', '2026-09-13T08:09:00Z'), alarmId: 'alarm-east', reason: 'Field response has not reached the isolated asset.' })).toThrow('not due');
        const escalated = escalateOverdueAlarm(acknowledged, { ...meta('a3', 1, 'dispatch', 'Dispatcher'), alarmId: 'alarm-east', reason: 'Field response has not reached the isolated asset.' });
        expect(escalated.alarms[0]?.status).toBe('escalated');
    });
    it('requires fresh telemetry and cleared alarms before restoration', () => {
        expect(() => requestRestoration(initialControlRoom, { ...meta('r1', 0, 'field', 'Field Operator'), assetId: 'battery-east', rationale: 'Isolation checks are complete and restoration is requested.' })).toThrow('stale telemetry');
        let state = refreshTelemetry(initialControlRoom, { ...meta('t1', 0, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 0, validMinutes: 30 });
        state = acknowledgeAlarm(state, { ...meta('a1', 1, 'controller', 'Grid Controller'), alarmId: 'alarm-east' });
        state = clearAlarm(state, { ...meta('a2', 2, 'controller', 'Grid Controller'), alarmId: 'alarm-east', evidence: 'Telemetry and field isolation readings now agree.' });
        state = requestRestoration(state, { ...meta('r1', 3, 'field', 'Field Operator'), assetId: 'battery-east', rationale: 'Isolation checks are complete and restoration is requested.' });
        expect(state.permits[0]).toMatchObject({ status: 'requested', telemetryRevision: 2 });
    });
    it('pins approval to telemetry and executes independent restoration', () => {
        let state = refreshTelemetry(initialControlRoom, { ...meta('t1', 0, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 0, validMinutes: 30 });
        state = acknowledgeAlarm(state, { ...meta('a1', 1, 'controller', 'Grid Controller'), alarmId: 'alarm-east' });
        state = clearAlarm(state, { ...meta('a2', 2, 'controller', 'Grid Controller'), alarmId: 'alarm-east', evidence: 'Telemetry and field isolation readings now agree.' });
        state = requestRestoration(state, { ...meta('r1', 3, 'field', 'Field Operator'), assetId: 'battery-east', rationale: 'Isolation checks are complete and restoration is requested.' });
        state = decideRestoration(state, { ...meta('r2', 4, 'controller', 'Grid Controller'), permitId: 'r1-permit', approve: true, rationale: 'Control review confirms every restoration gate is clear.' });
        state = executeRestoration(state, { ...meta('r3', 5, 'field', 'Field Operator'), permitId: 'r1-permit' });
        expect(state.assets['battery-east']).toBe('online'); expect(state.permits[0]?.status).toBe('executed');
    });
    it('rejects execution after a newer telemetry revision', () => {
        let state = structuredClone(initialControlRoom); state.alarms[0]!.status = 'cleared';
        state = refreshTelemetry(state, { ...meta('t1', 0, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 0, validMinutes: 30 });
        state = requestRestoration(state, { ...meta('r1', 1, 'field', 'Field Operator'), assetId: 'battery-east', rationale: 'Isolation checks are complete and restoration is requested.' });
        state = decideRestoration(state, { ...meta('r2', 2, 'controller', 'Grid Controller'), permitId: 'r1-permit', approve: true, rationale: 'Control review confirms every restoration gate is clear.' });
        state = refreshTelemetry(state, { ...meta('t2', 3, 'controller', 'Grid Controller'), assetId: 'battery-east', megawatts: 1, validMinutes: 30 });
        expect(() => executeRestoration(state, { ...meta('r3', 4, 'field', 'Field Operator'), permitId: 'r1-permit' })).toThrow('changed or expired');
    });
});
