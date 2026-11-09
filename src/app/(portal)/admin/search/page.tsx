import { SearchResults } from "@/components/search-results";
import { searchPortal } from "@/lib/services/portal-search";
import { parsePage } from "@/lib/pagination";

export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const groups = await searchPortal("admin", q, {
    users: parsePage(params["page-users"]),
    "document-types": parsePage(params["page-document-types"]),
    blockchain: parsePage(params["page-blockchain"]),
  });

  return <SearchResults query={q} groups={groups} searchPath="/admin/search" />;
}
