import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeReading } from './analytics';
import { canEditReading, readingStates } from './policy';
import { countReadingByState, searchReading, selectReading } from './selectors';
describe('reading domain module', () => { const records = fresh(product).entities; it('selects only reading records', () => expect(selectReading(records).every(record => record.kind === 'reading')).toBe(true)); it('searches deterministic fields', () => { const first = selectReading(records)[0]; expect(first ? searchReading(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countReadingByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectReading(records).length)); it('exposes configured states', () => expect(readingStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeReading(records).total).toBe(selectReading(records).length)); it('applies edit policy', () => expect(canEditReading(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'reading')!.editors.includes(product.actors[0]!.role))); });
