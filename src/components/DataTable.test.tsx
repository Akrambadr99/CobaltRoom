import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataTable } from './DataTable';
const columns = [{ key: 'record', label: 'Record', render: (row: { id: string }) => row.id }] as const;
describe('DataTable', () => {
  it('labels operational cells and explains an empty filtered view', () => { const { rerender } = render(<DataTable caption="Grid records" columns={columns} rows={[{ id: 'RECORD-1' }]} rowKey={(row) => row.id} />); expect(screen.getByRole('cell', { name: 'RECORD-1' })).toHaveAttribute('data-label', 'Record'); rerender(<DataTable caption="Grid records" columns={columns} rows={[]} rowKey={(row) => row.id} />); expect(screen.getByText('No grid records match the current view.')).toBeVisible(); });
});
