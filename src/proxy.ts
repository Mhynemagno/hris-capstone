import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

const protectedRoots = ["/admin", "/hr", "/employee", "/management"];

export function isAuthenticationProtectedPath(pathname: string): boolean {
  return (
    protectedRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`),
    ) ||
    (pathname !== "/applicant/register" &&
      (pathname === "/applicant" || pathname.startsWith("/applicant/")))
  );
}

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);

  if (!userId && isAuthenticationProtectedPath(request.nextUrl.pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const redirect = NextResponse.redirect(loginUrl);

    response.cookies
      .getAll()
      .forEach((cookie) => redirect.cookies.set(cookie));

    return redirect;
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
