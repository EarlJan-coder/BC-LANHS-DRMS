import { SearchResults } from "@/components/search-results";
import { searchPortal } from "@/lib/services/portal-search";

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const groups = await searchPortal("admin", q);

  return <SearchResults query={q} groups={groups} />;
}
