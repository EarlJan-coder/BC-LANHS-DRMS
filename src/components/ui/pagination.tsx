import Link from "next/link";

export function Pagination({
  page,
  totalPages,
  basePath,
  total,
  pageSize,
  pageParam = "page",
  query = {},
}: {
  page: number;
  totalPages: number;
  basePath: string;
  total: number;
  pageSize: number;
  pageParam?: string;
  query?: Record<string, string | undefined>;
}) {
  if (total === 0) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  const href = (nextPage: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    params.set(pageParam, String(nextPage));
    return `${basePath}?${params.toString()}`;
  };

  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-4 py-3">
      <p className="text-sm text-slate-500">Showing <span className="font-medium text-slate-700">{start}–{end}</span> of {total}</p>
      <div className="flex items-center gap-2">
        {page > 1 ? <Link href={href(page - 1)} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Previous</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm text-slate-400">Previous</span>}
        <span aria-current="page" className="px-2 text-sm text-slate-600">Page {page} of {totalPages}</span>
        {page < totalPages ? <Link href={href(page + 1)} className="rounded-md border border-border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">Next</Link> : <span aria-disabled="true" className="rounded-md border border-border px-3 py-2 text-sm text-slate-400">Next</span>}
      </div>
    </nav>
  );
}
