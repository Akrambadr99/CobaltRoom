import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeBattery } from './analytics';
import { canEditBattery, batteryStates } from './policy';
import { countBatteryByState, searchBattery, selectBattery } from './selectors';
describe('battery domain module', () => { const records = fresh(product).entities; it('selects only battery records', () => expect(selectBattery(records).every(record => record.kind === 'battery')).toBe(true)); it('searches deterministic fields', () => { const first = selectBattery(records)[0]; expect(first ? searchBattery(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countBatteryByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectBattery(records).length)); it('exposes configured states', () => expect(batteryStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeBattery(records).total).toBe(selectBattery(records).length)); it('applies edit policy', () => expect(canEditBattery(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'battery')!.editors.includes(product.actors[0]!.role))); });
