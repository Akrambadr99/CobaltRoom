import type { Product } from '../../workspace/types';
export function siteStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'site')?.states ?? []; }
export function canEditSite(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'site')?.editors.includes(role) ?? false; }
export function siteOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'site' && operation.roles.includes(role) && operation.from.includes(state)); }
