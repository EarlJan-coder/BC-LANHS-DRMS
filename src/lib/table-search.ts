export function rowMatchesQuery(text: string, query: string): boolean {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return normalizedQuery.length === 0 || text.toLocaleLowerCase().includes(normalizedQuery);
}
