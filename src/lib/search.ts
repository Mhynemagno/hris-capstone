/**
 * Shared search behaviour for every list screen: the typed text is split into words and a row
 * matches when every word appears somewhere in it, so "juan cruz", "cruz juan" and "PCPL 1234"
 * all find the same person regardless of which column each word is in.
 */
const MAX_TERMS = 6;

/** The words of a search box, lower-cased, without empties. Extra words beyond six are ignored. */
export function searchTerms(value: string | null | undefined) {
  return (value ?? "").toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

/**
 * Makes one typed word safe inside a PostgREST filter. Commas, parentheses, quotes, and
 * backslashes are filter syntax in `or=(...)` (a name like "Allen, Fernando" used to make the
 * request fail); `%` and `*` are wildcards. Each becomes `_`, which matches that one character.
 */
export function searchPattern(value: string) {
  return `%${value.replace(/[%*,()"\\]/g, "_")}%`;
}

/**
 * Server-side search on a table that exposes the `search_text` computed field (employees,
 * attendance logs, leave requests, deployments): one `ilike` per word, all of which must match.
 */
export function withSearch<Q extends { ilike: (column: string, pattern: string) => Q }>(query: Q, search: string | null | undefined) {
  return searchTerms(search).reduce((filtered, term) => filtered.ilike("search_text", searchPattern(term)), query);
}

/** Client-side counterpart for lists already held in memory: every word must appear in one of the values. */
export function matchesSearch(query: string, values: ReadonlyArray<string | number | null | undefined>) {
  const terms = searchTerms(query);
  if (!terms.length) return true;
  const haystack = values.filter((value) => value !== null && value !== undefined && value !== "").join(" ").toLowerCase();
  return terms.every((term) => haystack.includes(term));
}
