import { Rows3 } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { TableSearch } from "@/components/ui/table-search";
import { cn } from "@/lib/utils";

export type TableColumn<T> = {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
};

export function DataTable<T>({
  columns,
  rows,
  emptyMessage = "No records found.",
  renderRow,
  title,
  rowClassName,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  emptyMessage?: string;
  renderRow?: (row: T, index: number) => ReactNode;
  title?: string;
  rowClassName?: (row: T) => string | undefined;
}) {
  return (
    <Card className="overflow-hidden" data-table-card>
      <div className="flex flex-col gap-3 border-b border-border bg-white px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        {title ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-rose-50 text-brand">
              <Rows3 className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-slate-950">{title}</h3>
              <p className="mt-0.5 text-xs text-slate-500">{rows.length} {rows.length === 1 ? "record" : "records"} on this page</p>
            </div>
          </div>
        ) : null}
        <TableSearch label={title ? `Search ${title}` : undefined} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="whitespace-nowrap px-4 py-3 text-left font-semibold text-slate-600">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-white">
            {rows.length === 0 ? (
              <tr data-empty-row>
                <td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) =>
                renderRow ? (
                  renderRow(row, index)
                ) : (
                    <tr key={index} className={cn("hover:bg-rose-50/40", rowClassName?.(row))}>
                    {columns.map((column) => (
                      <td key={column.key} className="whitespace-nowrap px-4 py-3 text-slate-700">
                        {column.render(row)}
                      </td>
                    ))}
                  </tr>
                ),
              )
            )}
            {rows.length > 0 ? <tr data-search-empty hidden><td className="px-4 py-8 text-center text-sm text-slate-500" colSpan={columns.length}>No records match your search.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
