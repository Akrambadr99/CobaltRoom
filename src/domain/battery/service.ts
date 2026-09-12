import type { Command, Product, Snapshot, Value } from '../../workspace/types';
import { execute } from '../../workspace/engine';
import { findBattery } from './selectors';
export function createBatteryCommand(input: {
    id: string;
    actorId: string;
    revision: number;
    title: string;
    fields: Record<string, Value>;
}): Command { return { id: input.id, actorId: input.actorId, expectedRevision: input.revision, type: 'create', kind: 'battery', title: input.title, input: input.fields }; }
export function applyBatteryCommand(state: Snapshot, command: Command, product: Product, at: string): Snapshot { return execute(state, command, product, at); }
export function requireBattery(state: Snapshot, id: string) {
    const record = findBattery(state.entities, id);
    if (!record)
        throw new Error('Battery record was not found.');
    return record;
}
