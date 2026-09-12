import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeDispatch } from './analytics';
import { canEditDispatch, dispatchStates } from './policy';
import { countDispatchByState, searchDispatch, selectDispatch } from './selectors';
describe('dispatch domain module', () => { const records = fresh(product).entities; it('selects only dispatch records', () => expect(selectDispatch(records).every(record => record.kind === 'dispatch')).toBe(true)); it('searches deterministic fields', () => { const first = selectDispatch(records)[0]; expect(first ? searchDispatch(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countDispatchByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectDispatch(records).length)); it('exposes configured states', () => expect(dispatchStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeDispatch(records).total).toBe(selectDispatch(records).length)); it('applies edit policy', () => expect(canEditDispatch(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'dispatch')!.editors.includes(product.actors[0]!.role))); });
