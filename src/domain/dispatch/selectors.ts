import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isDispatch } from './model';
export function selectDispatch(records: readonly Entity[]): Entity[] { return records.filter(isDispatch).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findDispatch(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isDispatch(record) && record.id === id); }
export function searchDispatch(records: readonly Entity[], query: string): Entity[] { return selectDispatch(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countDispatchByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectDispatch(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
