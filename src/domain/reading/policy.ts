import type { Product } from '../../workspace/types';
export function readingStates(product: Product): readonly string[] { return product.kinds.find(kind => kind.key === 'reading')?.states ?? []; }
export function canEditReading(product: Product, role: string): boolean { return product.kinds.find(kind => kind.key === 'reading')?.editors.includes(role) ?? false; }
export function readingOperations(product: Product, role: string, state: string) { return product.operations.filter(operation => operation.kind === 'reading' && operation.roles.includes(role) && operation.from.includes(state)); }
