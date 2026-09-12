import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeMeter } from './analytics';
import { canEditMeter, meterStates } from './policy';
import { countMeterByState, searchMeter, selectMeter } from './selectors';
describe('meter domain module', () => { const records = fresh(product).entities; it('selects only meter records', () => expect(selectMeter(records).every(record => record.kind === 'meter')).toBe(true)); it('searches deterministic fields', () => { const first = selectMeter(records)[0]; expect(first ? searchMeter(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countMeterByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectMeter(records).length)); it('exposes configured states', () => expect(meterStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeMeter(records).total).toBe(selectMeter(records).length)); it('applies edit policy', () => expect(canEditMeter(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'meter')!.editors.includes(product.actors[0]!.role))); });
