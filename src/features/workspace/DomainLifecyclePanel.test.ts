import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { advanceRecovery } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('advanceRecovery', () => {
    it('advances a healthy site through ordered recovery', () => { const site = entity('s', 'site', 'online'), meters = [entity('m', 'meter', 'healthy', { site: 's' })]; let completed: readonly string[] = []; for (let index = 0; index < 4; index += 1) completed = advanceRecovery(completed, site, meters).completed; expect(completed).toEqual(['acknowledge', 'isolate', 'verify telemetry', 'restore']); });
    it('holds telemetry verification when a meter is stale', () => expect(advanceRecovery(['acknowledge', 'isolate'], entity('s', 'site', 'online'), [entity('m', 'meter', 'stale')]).error).toContain('healthy'));
});

import { product } from '../../product/definition';
import { execute, fresh } from '../../workspace/engine';
import type { Snapshot, Value } from '../../workspace/types';
const run = (state: Snapshot, id: string, target: string, operation: string, actorId = 'actor-2', input: Record<string, Value> = {}, now = '2026-09-12T10:00:00Z') => execute(state, { id, entityId: target, operation, actorId, input, expectedRevision: state.revision, type: 'operate' }, product, now);
const outageState = () => { const state = fresh(product); state.entities.push(entity('outage-1', 'outage', 'open', { site: 'site-1', cause: 'Grid feeder fault', customers: 100 })); return state; };
const isolated = () => run(run(outageState(), 'ack', 'outage-1', 'acknowledge-recovery'), 'isolate', 'outage-1', 'island');
describe('persisted outage recovery', () => {
    it('enforces order, persists failed verification and recovers from fresh telemetry', () => {
        expect(() => run(outageState(), 'skip', 'outage-1', 'restore')).toThrow('Verify recovery');
        expect(() => run(outageState(), 'skip', 'outage-1', 'island')).toThrow('Acknowledge');
        let state = run(isolated(), 'verify-empty', 'ack-1', 'verify-recovery');
        expect(state.entities.find(item => item.id === 'ack-1')?.status).toBe('failed');
        state = run(state, 'sample', 'meter-1', 'refresh-meter', 'actor-1', { health: 'healthy', kwh: 120 });
        state = run(state, 'verify', 'ack-1', 'verify-recovery');
        state = run(state, 'restore', 'outage-1', 'restore');
        expect(state.entities.find(item => item.id === 'ack-1')?.status).toBe('complete');
        expect(state.entities.find(item => item.id === 'site-1')?.status).toBe('online');
        expect(state.audit.map(item => item.action)).toEqual(['acknowledge-recovery', 'island', 'verify-recovery', 'refresh-meter', 'verify-recovery', 'restore']);
    });
    it('rejects expired or changed telemetry atomically and accepts re-verification', () => {
        let state = run(isolated(), 'sample', 'meter-1', 'refresh-meter', 'actor-1', { health: 'healthy', kwh: 120 });
        state = run(state, 'verify', 'ack-1', 'verify-recovery');
        const before = structuredClone(state);
        expect(() => run(state, 'late', 'outage-1', 'restore', 'actor-2', {}, '2026-09-12T10:06:00Z')).toThrow('expired');
        expect(state).toEqual(before);
        state = run(state, 'sample2', 'meter-1', 'refresh-meter', 'actor-1', { health: 'healthy', kwh: 125 });
        expect(() => run(state, 'stale', 'outage-1', 'restore')).toThrow('changed');
        state = run(state, 'reverify', 'ack-1', 'verify-recovery');
        expect(run(state, 'restore', 'outage-1', 'restore').entities.find(item => item.id === 'outage-1')?.status).toBe('restored');
    });
    it('requires reliability authority and keeps a site islanded while another outage is open', () => {
        let state = isolated();
        expect(() => run(state, 'wrong-role', 'ack-1', 'verify-recovery', 'actor-1')).toThrow('role');
        state.entities.push(entity('outage-2', 'outage', 'open', { site: 'site-1', cause: 'Second feeder fault', customers: 50 }));
        state = run(state, 'sample', 'meter-1', 'refresh-meter', 'actor-1', { health: 'healthy', kwh: 120 });
        state = run(state, 'verify', 'ack-1', 'verify-recovery');
        expect(run(state, 'restore', 'outage-1', 'restore').entities.find(item => item.id === 'site-1')?.status).toBe('islanded');
    });
});
