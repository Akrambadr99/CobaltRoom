import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findDispatch } from './selectors';
export function createDispatchCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'dispatch', title: input.title, input: input.fields }; }
export function applyDispatchCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireDispatch(state: Snapshot, id: string) {
    const record = findDispatch(state.entities, id);
    if (!record)
        throw new Error('Dispatch record was not found.');
    return record;
}
