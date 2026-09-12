import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findMeter } from './selectors';
export function createMeterCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'meter', title: input.title, input: input.fields }; }
export function applyMeterCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireMeter(state: Snapshot, id: string) {
    const record = findMeter(state.entities, id);
    if (!record)
        throw new Error('Meter record was not found.');
    return record;
}
