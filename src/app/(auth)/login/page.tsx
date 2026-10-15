import Link from "next/link";
import { redirect } from "next/navigation";

import { EmployeeAuthHero } from "@/components/auth/employee-auth-hero";
import { ApplicantAuthFrame } from "@/components/auth/applicant-auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { getRecruitmentNotice } from "@/lib/recruitment/recruitment-notice";

type LoginMode = "employee" | "applicant";

/** Visitors who arrive from a job's "Apply now" (or any applicant page) are signing in to the recruitment portal. */
function isRecruitmentPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/applicant", "/jobs"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** The login a visitor without "?as=" belongs on: applicants come from recruitment pages or sign-up confirmation. */
function defaultMode(nextPath: string, message: string | undefined): LoginMode {
  return isRecruitmentPath(nextPath) || message === "email_confirmed" || message === "email_confirmed_or_used" ? "applicant" : "employee";
}

/** Keeps the return path only when it belongs to the login being switched to. */
function switchHref(mode: LoginMode, nextPath: string) {
  const params = new URLSearchParams({ as: mode });
  if (nextPath !== "/" && (mode === "applicant" || !isRecruitmentPath(nextPath))) params.set("next", nextPath);
  return `/login?${params.toString()}`;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; error?: string; message?: string; next?: string }> }) {
  const { as, error, message, next } = await searchParams;
  const nextPath = getSafeNextPath(next);
  // There is no generic login any more: every visit lands on the Employee / HR or the applicant login.
  // The old Admin & HR Login (?as=admin) is now the Employee / HR login, where HR and SysAd use their badge.
  if (as !== "employee" && as !== "applicant") {
    const params = new URLSearchParams({ as: as === "admin" ? "employee" : defaultMode(nextPath, message) });
    if (nextPath !== "/") params.set("next", nextPath);
    if (error) params.set("error", error);
    if (message) params.set("message", message);
    redirect(`/login?${params.toString()}`);
  }
  const mode: LoginMode = as;
  const errorMessage = error === "invalid_credentials"
    ? "We could not sign you in. Check your details and try again."
    : error === "account_disabled"
      ? "This account can no longer sign in. Contact your system administrator if you think this is a mistake."
    : error === "invitation_expired"
      ? "This confirmation or invitation link is invalid or has expired. Request a new link and try again."
      : undefined;
  const notice = message === "email_confirmed"
    ? "Email confirmed. Please log in."
    : message === "email_confirmed_or_used"
      ? "Your email may already be confirmed. Try logging in."
      : undefined;
  if (mode === "applicant") {
    // Capstone UI loginapp.html, with the live Recruitment Notice.
    const recruitmentNotice = await getRecruitmentNotice();
    return (
      <ApplicantAuthFrame notice={recruitmentNotice}>
        <div className="mb-6">
          <span className="mb-3 inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-900 uppercase">
            Applicant Portal
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Login as Applicant</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Enter your registered email address below to access your application status and updates.
          </p>
        </div>
        <LoginForm error={errorMessage} mode="applicant" nextPath={nextPath} notice={notice} />
        <p className="mt-6 text-center text-xs text-slate-500">Don&apos;t have an account? Contact HR</p>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Station personnel?{" "}
          <Link className="font-semibold text-slate-500 hover:text-slate-700 hover:underline" href={switchHref("employee", nextPath)}>Login as Employee</Link>
        </p>
      </ApplicantAuthFrame>
    );
  }

  return (
    <ApplicantAuthFrame footerNote="San Juan City Police Station Personnel Portal" hero={<EmployeeAuthHero />} mobilePortalLabel="Employee Portal" portalDotClassName="bg-emerald-400" portalPill="HR Portal">
      <div className="mb-6">
        <span className="mb-3 inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-900 uppercase">Employee Portal</span>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Employee / HR</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
          Access your PDS.
        </p>
      </div>
      <LoginForm error={errorMessage} mode={mode} nextPath={nextPath} notice={notice} />
      <p className="mt-6 text-center text-xs text-slate-500">
        Accounts are created by your administrator. <Link className="font-bold text-blue-800 hover:text-blue-900 hover:underline" href={switchHref("applicant", nextPath)}>Login as Applicant</Link>
      </p>
    </ApplicantAuthFrame>
  );
}
