import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

/** Visitors who arrive from a job's "Apply now" (or any applicant page) are signing in to the recruitment portal. */
function isRecruitmentPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/applicant", "/jobs"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const nextPath = getSafeNextPath(next);
  const errorMessage = error === "invalid_credentials"
    ? "We could not sign you in. Check your details and try again."
    : error === "account_disabled"
      ? "This account can no longer sign in. Contact your system administrator if you think this is a mistake."
    : error === "invitation_expired"
      ? "This invitation link is invalid or has expired. Ask an administrator to send a new invitation."
      : undefined;
  const registerHref = nextPath === "/" ? "/applicant/register" : `/applicant/register?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-10 text-foreground sm:px-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-xl shadow-sidebar/10 sm:p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight">{isRecruitmentPath(nextPath) ? "PNP San Juan Recruitment" : "San Juan City Police HRIS"}</h1>
        <div className="mt-8"><LoginForm error={errorMessage} nextPath={nextPath} /></div>
        <p className="mt-6 text-center text-sm text-muted-foreground">Don&apos;t have an account?{" "}<Link className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline" href={registerHref}>Sign up<ArrowRight aria-hidden="true" className="size-4" /></Link></p>
      </section>
    </main>
  );
}
