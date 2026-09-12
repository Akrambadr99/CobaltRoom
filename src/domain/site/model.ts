import type { Entity } from '../../workspace/types';
export type SiteRecord = Entity & {
    kind: 'site';
};
export function isSite(record: Entity): record is SiteRecord { return record.kind === 'site'; }
