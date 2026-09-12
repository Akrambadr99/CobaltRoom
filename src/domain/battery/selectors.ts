import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isBattery } from './model';
export function selectBattery(records: readonly Entity[]): Entity[] { return records.filter(isBattery).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findBattery(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isBattery(record) && record.id === id); }
export function searchBattery(records: readonly Entity[], query: string): Entity[] { return selectBattery(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countBatteryByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectBattery(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
