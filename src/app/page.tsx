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
    <main className="flex flex-1 bg-slate-950 px-6 py-16 text-slate-50 sm:px-10 lg:py-24">
      <div className="mx-auto flex w-full max-w-5xl flex-col justify-center gap-12">
        <div className="max-w-2xl space-y-6">
          <p className="text-sm font-semibold tracking-[0.2em] text-sky-300 uppercase">
            HRIS Capstone
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
            className="inline-flex items-center justify-center gap-2 rounded-md bg-sky-400 px-5 py-3 font-medium text-slate-950 transition-colors hover:bg-sky-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
          >
            <LogIn aria-hidden="true" className="size-4" />
            Sign in
          </Link>
          <Link
            href="/jobs"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-700 px-5 py-3 font-medium text-white transition-colors hover:border-slate-500 hover:bg-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
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
