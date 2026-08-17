import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { DataTable, type DataTableColumn } from './DataTable'
import { render, screen } from '../../test/render'

interface ExampleRow {
  readonly id: string
  readonly title: string
}

const columns: readonly DataTableColumn<ExampleRow>[] = [
  {
    id: 'title',
    label: 'Title',
    sortField: 'title',
    render: (row) => row.title,
  },
]

describe('DataTable', () => {
  it('exposes table semantics and accessible sorting controls', async () => {
    const user = userEvent.setup()
    const onSort = vi.fn()

    render(
      <DataTable
        caption="Example records"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={[{ id: 'one', title: 'First record' }]}
        sort={{ field: 'title', direction: 'ascending' }}
        onSort={onSort}
      />,
    )

    expect(screen.getByRole('table', { name: 'Example records' })).toBeVisible()
    expect(screen.getByRole('columnheader', { name: /Title/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    )

    await user.click(screen.getByRole('button', { name: /Title/ }))
    expect(onSort).toHaveBeenCalledWith('title')
  })
})
