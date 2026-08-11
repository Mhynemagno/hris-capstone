export function getSafeNextPath(
  value: string | null | undefined,
  fallback = "/",
): string {
  if (!value?.startsWith("/")) {
    return fallback;
  }

  const candidate = new URL(value, "http://hris.local");

  if (candidate.origin !== "http://hris.local") {
    return fallback;
  }

  return `${candidate.pathname}${candidate.search}${candidate.hash}`;
}
