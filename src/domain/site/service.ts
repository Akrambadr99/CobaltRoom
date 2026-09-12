import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findSite } from './selectors';
export function createSiteCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'site', title: input.title, input: input.fields }; }
export function applySiteCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireSite(state: Snapshot, id: string) {
    const record = findSite(state.entities, id);
    if (!record)
        throw new Error('Site record was not found.');
    return record;
}
