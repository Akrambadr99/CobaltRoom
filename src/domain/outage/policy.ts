import type { Product } from '../../workspace/types';
export function outageStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'outage')?.states ?? []; }
export function canEditOutage(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'outage')?.editors.includes(role) ?? false; }
export function outageOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'outage' && operation.roles.includes(role) && operation.from.includes(state)); }
