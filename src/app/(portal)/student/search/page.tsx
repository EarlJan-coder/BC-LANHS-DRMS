import { SearchResults } from "@/components/search-results";
import { searchPortal } from "@/lib/services/portal-search";
import { parsePage } from "@/lib/pagination";

export default async function StudentSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const groups = await searchPortal("student", q, { requests: parsePage(params["page-requests"]) });

  return <SearchResults query={q} groups={groups} searchPath="/student/search" />;
}
