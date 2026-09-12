import type { Entity } from '../../workspace/types';
export type OutageRecord = Entity & {
    kind: 'outage';
};
export function isOutage(record: Entity): record is OutageRecord { return record.kind === 'outage'; }
