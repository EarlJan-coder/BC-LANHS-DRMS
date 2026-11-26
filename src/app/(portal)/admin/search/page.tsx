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
    pages: parsePage(params["page-pages"]),
    users: parsePage(params["page-users"]),
    "document-types": parsePage(params["page-document-types"]),
    registrations: parsePage(params["page-registrations"]),
    blockchain: parsePage(params["page-blockchain"]),
    notifications: parsePage(params["page-notifications"]),
  });

  return <SearchResults query={q} groups={groups} searchPath="/admin/search" />;
}
