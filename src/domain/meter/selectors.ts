import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isMeter } from './model';
export function selectMeter(records: readonly Entity[]): Entity[] { return records.filter(isMeter).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findMeter(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isMeter(record) && record.id === id); }
export function searchMeter(records: readonly Entity[], query: string): Entity[] { return selectMeter(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countMeterByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectMeter(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
