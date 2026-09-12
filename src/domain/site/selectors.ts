import type { Entity } from '../../workspace/types';
import { matchesSearch } from '../../core/search';
import { isSite } from './model';
export function selectSite(records: readonly Entity[]): Entity[] { return records.filter(isSite).toSorted((a, b) => a.title.localeCompare(b.title)); }
export function findSite(records: readonly Entity[], id: string): Entity | undefined { return records.find(record => isSite(record) && record.id === id); }
export function searchSite(records: readonly Entity[], query: string): Entity[] { return selectSite(records).filter(record => matchesSearch([record.id, record.title, record.status, ...Object.values(record.fields)], query)); }
export function countSiteByState(records: readonly Entity[]): ReadonlyMap<string, number> {
    const result = new Map<string, number>();
    for (const record of selectSite(records))
        result.set(record.status, (result.get(record.status) ?? 0) + 1);
    return result;
}
