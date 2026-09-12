import type { Entity } from '../../workspace/types';
export type BatteryRecord = Entity & {
    kind: 'battery';
};
export function isBattery(record: Entity): record is BatteryRecord { return record.kind === 'battery'; }
