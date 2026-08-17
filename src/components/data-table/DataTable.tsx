import type { ReactNode } from 'react'

import './data-table.css'

export interface DataTableColumn<TRow> {
  readonly id: string
  readonly label: string
  readonly render: (row: TRow) => ReactNode
  readonly sortField?: string
}

export interface DataTableSort {
  readonly field: string
  readonly direction: 'ascending' | 'descending'
}

interface DataTableProps<TRow> {
  readonly caption: string
  readonly columns: readonly DataTableColumn<TRow>[]
  readonly getRowKey: (row: TRow) => string
  readonly rows: readonly TRow[]
  readonly sort?: DataTableSort
  readonly onSort?: (field: string) => void
}

export function DataTable<TRow>({
  caption,
  columns,
  getRowKey,
  rows,
  sort,
  onSort,
}: DataTableProps<TRow>) {
  return (
    <div className="data-table-scroll" role="region" aria-label={caption}>
      <table className="data-table">
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sortField = column.sortField
              const isSorted = sort?.field === column.sortField
              const direction = isSorted ? sort?.direction : undefined

              return (
                <th key={column.id} scope="col" aria-sort={direction}>
                  {sortField && onSort ? (
                    <button
                      className="data-table__sort"
                      type="button"
                      onClick={() => {
                        onSort(sortField)
                      }}
                    >
                      {column.label}
                      <span aria-hidden="true">
                        {direction
                          ? direction === 'ascending'
                            ? ' ↑'
                            : ' ↓'
                          : ' ↕'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={getRowKey(row)}>
              {columns.map((column) => (
                <td key={column.id}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
