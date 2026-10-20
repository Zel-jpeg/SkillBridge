import { useMemo } from 'react'
import { getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'

const empty = []

// The page owns filters and pagination so cards, tables and exports use one order.
export function useAnalyticsRecords({ report, students, studentTable, fullColumns, sorting, onSortingChange }) {
  'use no memo' // TanStack v8 exposes a mutable table instance; keep this hook uncompiled.
  const data = useMemo(() => report?.rows.map((values, index) => ({ values, student: studentTable ? students[index] : null })) ?? empty, [report, students, studentTable])
  const columns = useMemo(() => report?.columns.map((header, index) => ({
    id: String(index), header,
    accessorFn: row => row.values[index] ?? undefined,
    sortUndefined: 'last',
    sortDescFirst: false,
  })) ?? empty, [report])
  const columnVisibility = useMemo(() => Object.fromEntries(columns.map(column => [column.id, !studentTable || fullColumns || ['0', '4', '5', '7', '12', '10'].includes(column.id)])), [columns, studentTable, fullColumns])
  // This Vite app does not use React Compiler. Consumers read the instance on each render.
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack v8 is intentionally used without compiler memoization.
  return useReactTable({
    data, columns,
    state: { sorting, columnVisibility },
    onSortingChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiSort: false,
    autoResetPageIndex: false,
  })
}
