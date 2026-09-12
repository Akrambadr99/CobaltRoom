import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { advanceRecovery } from './DomainLifecyclePanel';
const entity = (id: string, kind: string, status: string, fields: Entity['fields'] = {}): Entity => ({ id, kind, status, fields, title: id, revision: 1 });
describe('advanceRecovery', () => {
    it('advances a healthy site through ordered recovery', () => { const site = entity('s', 'site', 'online'), meters = [entity('m', 'meter', 'healthy', { site: 's' })]; let completed: readonly string[] = []; for (let index = 0; index < 4; index += 1) completed = advanceRecovery(completed, site, meters).completed; expect(completed).toEqual(['acknowledge', 'isolate', 'verify telemetry', 'restore']); });
    it('holds telemetry verification when a meter is stale', () => expect(advanceRecovery(['acknowledge', 'isolate'], entity('s', 'site', 'online'), [entity('m', 'meter', 'stale')]).error).toContain('healthy'));
});
