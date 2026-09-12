import { describe, expect, it } from 'vitest';
import type { Entity } from '../../workspace/types';
import { searchTelemetry } from './DomainWorkflowPanel';
const reading = (id: string, source: string, kwh: number): Entity => ({ id, kind: 'reading', status: 'accepted', title: `Meter ${id}`, revision: 1, fields: { source, kwh } });
describe('searchTelemetry', () => {
    it('combines text and source filters', () => expect(searchTelemetry([reading('A', 'meter', 10), reading('B', 'corrected', 20)], 'B', 'corrected').map((item) => item.id)).toEqual(['B']));
    it('does not mutate the source order', () => { const rows = [reading('A', 'meter', 10), reading('B', 'meter', 20)]; searchTelemetry(rows, '', ''); expect(rows.map((item) => item.id)).toEqual(['A', 'B']); });
});
