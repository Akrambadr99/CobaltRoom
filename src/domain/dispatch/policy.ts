import type { Product } from '../../workspace/types';
export function dispatchStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'dispatch')?.states ?? []; }
export function canEditDispatch(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'dispatch')?.editors.includes(role) ?? false; }
export function dispatchOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'dispatch' && operation.roles.includes(role) && operation.from.includes(state)); }
