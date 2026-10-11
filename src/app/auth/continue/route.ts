import { NextResponse, type NextRequest } from "next/server";

import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getRoleHome } from "@/lib/auth/role-home";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

function isWithin(destination: string, root: string) {
  const pathname = new URL(destination, "http://hris.local").pathname;
  return pathname === root || pathname.startsWith(`${root}/`);
}

function canContinueTo(role: Awaited<ReturnType<typeof getCurrentRole>>, pathname: string, home: string) {
  if (isWithin(pathname, home) || isWithin(pathname, "/notifications")) return true;
  if ((role === "hr_personnel" || role === "management") && isWithin(pathname, "/reports")) return true;
  return role === "applicant" && isWithin(pathname, "/jobs");
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    // Keep where the visitor was going (e.g. the portal link in an email) and pick the matching login.
    const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
    const login = new URL("/login", request.url);
    login.searchParams.set("as", isWithin(nextPath, "/applicant") || isWithin(nextPath, "/jobs") ? "applicant" : "employee");
    if (nextPath !== "/") login.searchParams.set("next", nextPath);
    return NextResponse.redirect(login);
  }

  const role = await getCurrentRole();
  if (!role) return NextResponse.redirect(new URL("/unauthorized", request.url));

  const home = getRoleHome(role);
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const destination = canContinueTo(role, nextPath, home) ? nextPath : home;

  return NextResponse.redirect(new URL(destination, request.url));
}
