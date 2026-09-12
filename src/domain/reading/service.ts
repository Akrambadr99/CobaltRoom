import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findReading } from './selectors';
export function createReadingCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'reading', title: input.title, input: input.fields }; }
export function applyReadingCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireReading(state: Snapshot, id: string) {
    const record = findReading(state.entities, id);
    if (!record)
        throw new Error('Reading record was not found.');
    return record;
}
