import { describe, expect, it } from 'vitest';
import { product } from '../product/definition';
import { execute, fresh } from '../workspace/engine';
import type { Snapshot, Value } from '../workspace/types';
const reason = 'Maintain adequate emergency reserve for the evening peak.';
function act(state: Snapshot, operation: string, entityId: string, actorId: string, input: Record<string, Value> = {}) {
    return execute(state, { id: 'c-' + String(state.revision), expectedRevision: state.revision, actorId, type: 'operate', operation, entityId, input }, product, '2026-09-13T12:00:00Z');
}
function request(reserve = 4900) { return act(fresh(product), 'reserve-request', 'site-1', 'actor-1', { reserve, reason }); }
describe('site reserve governance', () => {
    it('applies independent approval and records the policy transition', () => {
        const approved = act(request(), 'reserve-approve', 'c-0-1', 'actor-0');
        const result = act(approved, 'reserve-apply', 'c-0-1', 'actor-0');
        expect(result.entities.find(item => item.id === 'site-1')?.fields['reserve']).toBe(4900);
        expect(result.audit.at(-1)?.action).toBe('reserve-apply');
    });
    it('rejects duplicate requests and operator self-approval', () => {
        const state = request();
        expect(() => act(state, 'reserve-request', 'site-1', 'actor-1', { reserve: 500, reason })).toThrow(/already pending/);
        expect(() => act(state, 'reserve-approve', 'c-0-1', 'actor-1')).toThrow(/role/);
    });
    it('requires fresh approval after a site revision changes', () => {
        const state = act(request(), 'reserve-approve', 'c-0-1', 'actor-0');
        state.entities.find(item => item.id === 'site-1')!.revision++;
        expect(() => act(state, 'reserve-apply', 'c-0-1', 'actor-0')).toThrow(/Site changed/);
        const revised = act(state, 'reserve-revise', 'c-0-1', 'actor-1', { reserve: 4000, reason });
        expect(() => act(revised, 'reserve-apply', 'c-0-1', 'actor-0')).toThrow(/current state/);
    });
    it('rechecks dispatch commitments after approval', () => {
        let state = act(request(5000), 'reserve-approve', 'c-0-1', 'actor-0');
        state = act(state, 'activate', 'dispatch-1', 'actor-0');
        expect(() => act(state, 'reserve-apply', 'c-0-1', 'actor-0')).toThrow(/committed battery dispatch/);
    });
    it('prevents generic edits from bypassing reserve approval', () => {
        const state = fresh(product); const site = state.entities.find(item => item.id === 'site-1')!;
        expect(() => execute(state, { id: 'edit', expectedRevision: 0, actorId: 'actor-0', type: 'edit', entityId: site.id,
            title: site.title, input: { ...site.fields, reserve: 0 } }, product, '2026-09-13T12:00:00Z')).toThrow(/governed workflow/);
    });
    it('blocks discharge under an applied full-capacity reserve without consuming battery state', () => {
        const approved = act(request(5000), 'reserve-approve', 'c-0-1', 'actor-0');
        const state = act(approved, 'reserve-apply', 'c-0-1', 'actor-0');const before = JSON.stringify(state);
        expect(() => act(state, 'activate', 'dispatch-1', 'actor-0')).toThrow(/site reserve/);
        expect(JSON.stringify(state)).toBe(before);
    });
});
