import type { Entity } from '../../workspace/types';
export type MeterRecord = Entity & {
    kind: 'meter';
};
export function isMeter(record: Entity): record is MeterRecord { return record.kind === 'meter'; }
