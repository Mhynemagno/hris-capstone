import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

/**
 * Photo shown beside the form on larger screens, e.g. "/login-photo.jpg" in public/.
 * Leave it null to show the station's brand panel instead.
 */
const LOGIN_PANEL_IMAGE: string | null = null;

type LoginMode = "employee" | "applicant";

/** Visitors who arrive from a job's "Apply now" (or any applicant page) are signing in to the recruitment portal. */
function isRecruitmentPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/applicant", "/jobs"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

function loginMode(as: string | undefined, nextPath: string): LoginMode | null {
  if (as === "employee" || as === "applicant") return as;
  return isRecruitmentPath(nextPath) ? "applicant" : null;
}

function switchHref(mode: LoginMode, nextPath: string) {
  const params = new URLSearchParams({ as: mode });
  if (nextPath !== "/" && (mode === "applicant" || !isRecruitmentPath(nextPath))) params.set("next", nextPath);
  return `/login?${params.toString()}`;
}

function BrandPanel() {
  return (
    <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
      {LOGIN_PANEL_IMAGE ? (
        <>
          <Image alt="" className="object-cover" fill priority sizes="50vw" src={LOGIN_PANEL_IMAGE} />
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-sidebar via-sidebar/60 to-sidebar/10" />
        </>
      ) : null}
      <div className="relative flex items-center gap-4 p-10">
        <Image alt="San Juan City Police Station logo" className="size-20 object-contain drop-shadow-md" height={80} priority src="/san-juan-police-logo.png" width={80} />
        <span aria-hidden="true" className="h-12 w-px bg-white/20" />
        <span className="rounded-xl bg-white p-2 shadow-md">
          <Image alt="Bagong Pilipinas logo" className="h-16 w-auto object-contain" height={64} priority src="/bagong-pilipinas-logo.png" width={69} />
        </span>
      </div>
      <div className="relative p-10">
        <div aria-hidden="true" className="h-1 w-12 bg-brand-command-red" />
        <p className="mt-4 text-sm font-semibold tracking-[0.18em] text-sidebar-ring uppercase">San Juan City Police Station</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-white">Serbisyo, Karangalan, Katarungan</p>
        <p className="mt-3 max-w-sm text-base leading-7 text-slate-300">Service, Honor, Justice</p>
      </div>
    </aside>
  );
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; error?: string; next?: string }> }) {
  const { as, error, next } = await searchParams;
  const nextPath = getSafeNextPath(next);
  const mode = loginMode(as, nextPath);
  const errorMessage = error === "invalid_credentials"
    ? "We could not sign you in. Check your details and try again."
    : error === "account_disabled"
      ? "This account can no longer sign in. Contact your system administrator if you think this is a mistake."
    : error === "invitation_expired"
      ? "This invitation link is invalid or has expired. Ask an administrator to send a new invitation."
      : undefined;
  const registerHref = nextPath === "/" ? "/applicant/register" : `/applicant/register?next=${encodeURIComponent(nextPath)}`;
  const title = mode === "employee" ? "Employee login" : mode === "applicant" ? "Applicant login" : "Login";
  const eyebrow = mode === "applicant" ? "PNP San Juan Recruitment" : "San Juan City Police HRIS";

  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-8 text-foreground sm:px-6 lg:p-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-xl shadow-sidebar/15 lg:min-h-[36rem] lg:grid-cols-2">
        <div className="flex items-center p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm">
            <div className="flex items-center gap-3 lg:hidden">
              <Image alt="" className="size-12 object-contain" height={48} src="/san-juan-police-logo.png" width={48} />
              <Image alt="" className="h-11 w-auto object-contain" height={44} src="/bagong-pilipinas-logo.png" width={47} />
            </div>
            <p className="mt-6 text-sm font-semibold tracking-[0.18em] text-primary uppercase lg:mt-0">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{title}</h1>
            <div className="mt-8"><LoginForm error={errorMessage} mode={mode} nextPath={nextPath} /></div>
            {mode === "employee" ? (
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Accounts are created by your administrator.{" "}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={switchHref("applicant", nextPath)}>Login as Applicant</Link>
              </p>
            ) : (
              <>
                <p className="mt-6 text-center text-sm text-muted-foreground">Don&apos;t have an account?{" "}<Link className="inline-flex items-center gap-1 font-semibold text-primary underline-offset-4 hover:underline" href={registerHref}>Sign up<ArrowRight aria-hidden="true" className="size-4" /></Link></p>
                {mode === "applicant" ? (
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    Station personnel?{" "}
                    <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={switchHref("employee", nextPath)}>Login as Employee</Link>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
        <BrandPanel />
      </section>
    </main>
  );
}
