import { ArrowRight, BriefcaseBusiness, LogIn } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getRoleHome } from "@/lib/auth/role-home";

export default async function Home() {
  const user = await getAuthenticatedUser();

  if (user) {
    const role = await getCurrentRole();
    redirect(role ? getRoleHome(role) : "/unauthorized");
  }

  return (
    <main className="flex flex-1 bg-sidebar px-6 py-16 text-sidebar-foreground sm:px-10 lg:py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-12">
        <div className="max-w-2xl space-y-6">
          <div aria-hidden="true" className="h-1 w-14 bg-brand-command-red" />
          <p className="text-sm font-semibold tracking-[0.2em] text-blue-200 uppercase">
            San Juan City Police
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-6xl">
            A secure home for your workforce information.
          </h1>
          <p className="max-w-xl text-lg leading-8 text-slate-300">
            Personnel management, employee self-service, and recruitment tools
            are being prepared for your organization.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            <LogIn aria-hidden="true" className="size-4" />
            Sign in
          </Link>
          <Link
            href="/jobs"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-sidebar-border px-5 py-3 font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:w-auto"
          >
            <BriefcaseBusiness aria-hidden="true" className="size-4" />
            View job openings
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
      </main>
  );
}
