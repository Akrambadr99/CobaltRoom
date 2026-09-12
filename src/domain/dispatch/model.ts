import type { Entity } from '../../workspace/types';
export type DispatchRecord = Entity & {
    kind: 'dispatch';
};
export function isDispatch(record: Entity): record is DispatchRecord { return record.kind === 'dispatch'; }
