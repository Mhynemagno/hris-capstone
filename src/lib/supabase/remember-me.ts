/** Present (value "1") when an applicant signed in without "Remember me": auth cookies are then session cookies. */
export const SESSION_ONLY_COOKIE = "hris-session-only";

type CookieOptionsLike = { maxAge?: number; expires?: Date };

/**
 * @supabase/ssr always writes auth cookies with a 400-day maxAge. Without "Remember me" we drop maxAge/expires
 * so the browser forgets the session when it closes. Removals (maxAge 0) pass through untouched.
 */
export function applyRememberMe<T extends CookieOptionsLike>(options: T | undefined, sessionOnly: boolean): T | undefined {
  if (!options || !sessionOnly || options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}

export function readSessionOnly(cookies: { get(name: string): { value: string } | undefined }) {
  return cookies.get(SESSION_ONLY_COOKIE)?.value === "1";
}

/** Browser-side: forget the preference at sign-out. */
export function clearSessionOnlyCookie() {
  document.cookie = `${SESSION_ONLY_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
