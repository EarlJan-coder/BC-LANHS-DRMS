import { SearchX } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "@/components/section-heading";
import { Card } from "@/components/ui/card";
import type { SearchGroup } from "@/lib/services/portal-search";

export function SearchResults({ query, groups }: { query: string; groups: SearchGroup[] }) {
  const trimmed = query.trim();

  if (!trimmed) {
    return (
      <div>
        <SectionHeading title="Search" description="Find records, requests, students, and more across this portal." />
        <Card className="p-8 text-center text-sm text-slate-500">
          Type a keyword in the search bar above — tracking number, student name, LRN, document type, or email.
        </Card>
      </div>
    );
  }

  const withHits = groups.filter((group) => group.total > 0);

  if (withHits.length === 0) {
    return (
      <div>
        <SectionHeading title={`No results for “${trimmed}”`} description="Try a different keyword or fewer characters." />
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <SearchX className="h-8 w-8 text-slate-400" aria-hidden />
          <p className="text-sm text-slate-500">Nothing matched your search in this portal.</p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <SectionHeading
        title={`Results for “${trimmed}”`}
        description="Matches grouped by record type across this portal."
      />
      <div className="grid gap-4">
        {withHits.map((group) => (
          <Card key={group.key} className="overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-border bg-slate-50 px-4 py-3">
              <h2 className="text-sm font-semibold text-slate-700">
                {group.label}
                <span className="ml-2 font-normal text-slate-500">
                  {group.total} {group.total === 1 ? "match" : "matches"}
                </span>
              </h2>
              {group.viewAllHref ? (
                <Link
                  href={`${group.viewAllHref}?q=${encodeURIComponent(trimmed)}`}
                  prefetch={false}
                  className="shrink-0 text-xs font-medium text-brand hover:underline"
                >
                  View all
                </Link>
              ) : null}
            </div>
            <ul className="divide-y divide-border">
              {group.hits.map((hit) => (
                <li key={hit.id}>
                  <Link
                    href={hit.href}
                    prefetch={false}
                    className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-rose-50/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-brand">{hit.title}</span>
                      {hit.subtitle ? (
                        <span className="block truncate text-xs text-slate-500">{hit.subtitle}</span>
                      ) : null}
                    </span>
                    {hit.meta ? (
                      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                        {hit.meta}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
