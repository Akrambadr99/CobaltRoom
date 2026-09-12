import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isReading } from './model';
export function selectReading(records: readonly Entity[]): Entity[] { return records.filter(isReading).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findReading(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isReading(record) && record.id === id); }
export function searchReading(records: readonly Entity[], query: string): Entity[] { return selectReading(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countReadingByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectReading(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
