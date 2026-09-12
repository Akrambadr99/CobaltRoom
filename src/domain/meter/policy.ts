import type { Product } from '../../workspace/types';
export function meterStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'meter')?.states ?? []; }
export function canEditMeter(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'meter')?.editors.includes(role) ?? false; }
export function meterOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'meter' && operation.roles.includes(role) && operation.from.includes(state)); }
