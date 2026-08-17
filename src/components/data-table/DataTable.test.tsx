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

  it('supports page-level and row-level selection with an indeterminate state', async () => {
    const user = userEvent.setup()
    const onToggleRow = vi.fn()
    const onToggleAllRows = vi.fn()
    const rows = [
      { id: 'one', title: 'First record' },
      { id: 'two', title: 'Second record' },
    ]

    render(
      <DataTable
        caption="Selectable records"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={rows}
        selection={{
          getLabel: (row) => `Select ${row.title}`,
          isSelected: (row) => row.id === 'one',
          onToggleRow,
          onToggleAllRows,
        }}
      />,
    )

    const selectAll = screen.getByRole('checkbox', {
      name: 'Select all rows on this page',
    })
    expect(selectAll).toHaveProperty('indeterminate', true)

    await user.click(screen.getByRole('checkbox', { name: 'Select Second record' }))
    expect(onToggleRow).toHaveBeenCalledWith(rows[1], true)

    await user.click(selectAll)
    expect(onToggleAllRows).toHaveBeenCalledWith(rows, true)
  })

  it('excludes permission-disabled rows from page selection', async () => {
    const user = userEvent.setup()
    const onToggleAllRows = vi.fn()
    const rows = [
      { id: 'one', title: 'Editable record' },
      { id: 'two', title: 'Read-only record' },
    ]

    render(
      <DataTable
        caption="Permission-aware records"
        columns={columns}
        getRowKey={(row) => row.id}
        rows={rows}
        selection={{
          getLabel: (row) => `Select ${row.title}`,
          isRowSelectable: (row) => row.id === 'one',
          isSelected: () => false,
          onToggleRow: vi.fn(),
          onToggleAllRows,
        }}
      />,
    )

    expect(
      screen.getByRole('checkbox', { name: 'Select Read-only record' }),
    ).toBeDisabled()
    await user.click(
      screen.getByRole('checkbox', { name: 'Select all rows on this page' }),
    )
    expect(onToggleAllRows).toHaveBeenCalledWith([rows[0]], true)
  })
})
