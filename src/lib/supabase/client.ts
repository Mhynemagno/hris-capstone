import { createBrowserClient } from "@supabase/ssr";

import { getPublicSupabaseConfig } from "./env";
import { applyRememberMe, SESSION_ONLY_COOKIE } from "./remember-me";

type BrowserCookieOptions = { path?: string; domain?: string; maxAge?: number; expires?: Date; sameSite?: boolean | "lax" | "strict" | "none"; secure?: boolean };

function readCookies() {
  return document.cookie.split("; ").filter(Boolean).map((pair) => {
    const index = pair.indexOf("=");
    return { name: decodeURIComponent(pair.slice(0, index)), value: decodeURIComponent(pair.slice(index + 1)) };
  });
}

function serializeCookie(name: string, value: string, options: BrowserCookieOptions = {}) {
  const parts = [`${encodeURIComponent(name)}=${encodeURIComponent(value)}`, `Path=${options.path ?? "/"}`];
  if (options.domain) parts.push(`Domain=${options.domain}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.sameSite) parts.push(`SameSite=${options.sameSite === true ? "Strict" : options.sameSite[0]!.toUpperCase() + options.sameSite.slice(1)}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function createBrowserSupabaseClient() {
  const { url, publishableKey } = getPublicSupabaseConfig();

  // Cookies are written here (rather than by @supabase/ssr's default) so token refreshes honour "Remember me".
  return createBrowserClient(url, publishableKey, {
    cookies: {
      getAll: readCookies,
      setAll(cookiesToSet) {
        const sessionOnly = readCookies().some(({ name, value }) => name === SESSION_ONLY_COOKIE && value === "1");
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serializeCookie(name, value, applyRememberMe(options as BrowserCookieOptions, sessionOnly));
        });
      },
    },
  });
}
