import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isOutage } from './model';
export function selectOutage(records: readonly Entity[]): Entity[] { return records.filter(isOutage).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findOutage(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isOutage(record) && record.id === id); }
export function searchOutage(records: readonly Entity[], query: string): Entity[] { return selectOutage(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countOutageByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectOutage(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
