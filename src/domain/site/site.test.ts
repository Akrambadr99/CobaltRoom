import { describe, expect, it } from 'vitest';
import { product } from '../../product/definition';
import { fresh } from '../../workspace/engine';
import { analyzeSite } from './analytics';
import { canEditSite, siteStates } from './policy';
import { countSiteByState, searchSite, selectSite } from './selectors';
describe('site domain module', () => { const records = fresh(product).entities; it('selects only site records', () => expect(selectSite(records).every(record => record.kind === 'site')).toBe(true)); it('searches deterministic fields', () => { const first = selectSite(records)[0]; expect(first ? searchSite(records, first.title).map(row => row.id) : []).toEqual(first ? [first.id] : []); }); it('summarizes states', () => expect([...countSiteByState(records).values()].reduce((sum, value) => sum + value, 0)).toBe(selectSite(records).length)); it('exposes configured states', () => expect(siteStates(product).length).toBeGreaterThan(0)); it('reports analytics', () => expect(analyzeSite(records).total).toBe(selectSite(records).length)); it('applies edit policy', () => expect(canEditSite(product, product.actors[0]!.role)).toBe(product.kinds.find(kind => kind.key === 'site')!.editors.includes(product.actors[0]!.role))); });
