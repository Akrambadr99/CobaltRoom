import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeOutage } from './analytics';
import { canEditOutage, outageStates } from './policy';
import { countOutageByState, searchOutage, selectOutage } from './selectors';
describe('outage domain module', () => { const records = fresh(product).entities; it('selects only outage records', () => expect(selectOutage(records).every(record => record.kind === 'outage')).toBe(true)); it('searches deterministic fields', () => { const first = selectOutage(records)[0]; expect(first ? searchOutage(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countOutageByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectOutage(records).length)); it('exposes configured states', () => expect(outageStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeOutage(records).total).toBe(selectOutage(records).length)); it('applies edit policy', () => expect(canEditOutage(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'outage')!.editors.includes(product.actors[0]!.role))); });
