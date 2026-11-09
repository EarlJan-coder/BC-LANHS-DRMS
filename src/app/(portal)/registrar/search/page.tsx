import { SearchResults } from "@/components/search-results";
import { searchPortal } from "@/lib/services/portal-search";
import { parsePage } from "@/lib/pagination";

export default async function RegistrarSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q : "";
  const groups = await searchPortal("registrar", q, {
    requests: parsePage(params["page-requests"]),
    students: parsePage(params["page-students"]),
    certificates: parsePage(params["page-certificates"]),
    audit: parsePage(params["page-audit"]),
  });

  return <SearchResults query={q} groups={groups} searchPath="/registrar/search" />;
}
