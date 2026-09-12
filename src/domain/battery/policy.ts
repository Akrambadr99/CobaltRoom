import type { Product } from '../../workspace/types';
export function batteryStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'battery')?.states ?? []; }
export function canEditBattery(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'battery')?.editors.includes(role) ?? false; }
export function batteryOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'battery' && operation.roles.includes(role) && operation.from.includes(state)); }
