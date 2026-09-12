import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findOutage } from './selectors';
export function createOutageCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'outage', title: input.title, input: input.fields }; }
export function applyOutageCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireOutage(state: Snapshot, id: string) {
    const record = findOutage(state.entities, id);
    if (!record)
        throw new Error('Outage record was not found.');
    return record;
}
