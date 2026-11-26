"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { rowMatchesQuery } from "@/lib/table-search";

export function TableSearch({ label }: { label?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const [hasQuery, setHasQuery] = useState(false);
  const applyFilter = useCallback(() => {
    const input = inputRef.current;
    const card = input?.closest("[data-table-card]");
    if (!input || !card) return;
    const query = input.value;
    setHasQuery(query.trim().length > 0);
    let matches = 0;
    const rows = card.querySelectorAll<HTMLTableRowElement>("tbody tr:not([data-empty-row]):not([data-search-empty])");
    rows.forEach((row) => {
      const visible = rowMatchesQuery(row.textContent ?? "", query);
      row.hidden = !visible;
      if (visible) matches += 1;
    });
    setMatchCount(matches);
    const noMatch = card.querySelector<HTMLTableRowElement>("tbody tr[data-search-empty]");
    if (noMatch) noMatch.hidden = query.trim().length === 0 || matches > 0;
  }, []);

  useEffect(() => { applyFilter(); });

  return (
    <div className="flex w-full items-center gap-2 sm:max-w-xs">
      <label className="relative block min-w-0 flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
        <input ref={inputRef} type="search" placeholder="Search this table" aria-label={label ?? "Search table"} onChange={applyFilter} className="w-full rounded-md border border-border bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand focus:bg-white focus:ring-2 focus:ring-rose-100" />
      </label>
      {hasQuery ? (
        <span aria-live="polite" className="shrink-0 text-xs font-medium tabular-nums text-slate-500">
          {matchCount ?? 0} {matchCount === 1 ? "match" : "matches"}
        </span>
      ) : <span className="sr-only" aria-live="polite">{matchCount ?? 0} matching rows</span>}
    </div>
  );
}
