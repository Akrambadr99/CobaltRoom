import type { Entity } from '../../workspace/types';
export type ReadingRecord = Entity & {
    kind: 'reading';
};
export function isReading(record: Entity): record is ReadingRecord { return record.kind === 'reading'; }
