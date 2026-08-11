import { NextResponse, type NextRequest } from "next/server";

import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getRoleHome } from "@/lib/auth/role-home";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const role = await getCurrentRole();
  if (!role) return NextResponse.redirect(new URL("/unauthorized", request.url));

  const home = getRoleHome(role);
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const destination =
    nextPath === home || nextPath.startsWith(`${home}/`) ? nextPath : home;

  return NextResponse.redirect(new URL(destination, request.url));
}
