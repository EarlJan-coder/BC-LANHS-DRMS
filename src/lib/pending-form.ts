/**
 * Build the href a native GET form submission would navigate to.
 *
 * Semantics match the browser's `application/x-www-form-urlencoded` GET
 * submission: empty values are kept (`?q=&status=`), spaces encode as `+`,
 * repeated names are preserved, and a stale query on the action is replaced.
 * The fragment (if any) stays after the query.
 */
export function formSubmitHref(
  action: string,
  entries: Iterable<readonly [string, string]>,
): string {
  const params = new URLSearchParams();
  for (const [name, value] of entries) {
    params.append(name, value);
  }

  const hashIndex = action.indexOf("#");
  const beforeFragment = hashIndex === -1 ? action : action.slice(0, hashIndex);
  const fragment = hashIndex === -1 ? "" : action.slice(hashIndex);
  const path = beforeFragment.split("?")[0];

  const query = params.toString();
  return query ? `${path}?${query}${fragment}` : `${path}${fragment}`;
}
