import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminAuthHero, EmployeeAuthHero } from "@/components/auth/admin-auth-hero";
import { ApplicantAuthFrame } from "@/components/auth/applicant-auth-frame";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";
import { getRecruitmentNotice } from "@/lib/recruitment/recruitment-notice";
import { ADMIN_ACCESS_LEVELS, adminAccessLevel } from "@/schemas/auth";

type LoginMode = "employee" | "applicant" | "admin";

/** Visitors who arrive from a job's "Apply now" (or any applicant page) are signing in to the recruitment portal. */
function isRecruitmentPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/applicant", "/jobs"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** HR and System Administrators sign in at the Admin & HR Login. */
function isAdminPath(path: string) {
  const pathname = new URL(path, "http://hris.local").pathname;
  return ["/hr", "/admin"].some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** The login a visitor without "?as=" belongs on: applicants come from recruitment pages or sign-up confirmation. */
function defaultMode(nextPath: string, message: string | undefined): LoginMode {
  if (isRecruitmentPath(nextPath) || message === "email_confirmed" || message === "email_confirmed_or_used") return "applicant";
  return isAdminPath(nextPath) ? "admin" : "employee";
}

/** Keeps the return path only when it belongs to the login being switched to. */
function switchHref(mode: LoginMode, nextPath: string) {
  const params = new URLSearchParams({ as: mode });
  const belongs = mode === "applicant" || (mode === "admin" ? isAdminPath(nextPath) : !isRecruitmentPath(nextPath) && !isAdminPath(nextPath));
  if (nextPath !== "/" && belongs) params.set("next", nextPath);
  return `/login?${params.toString()}`;
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; error?: string; level?: string; message?: string; next?: string }> }) {
  const { as, error, level, message, next } = await searchParams;
  const nextPath = getSafeNextPath(next);
  // There is no generic login any more: every visit lands on the employee or the applicant login.
  if (as !== "employee" && as !== "applicant" && as !== "admin") {
    const params = new URLSearchParams({ as: defaultMode(nextPath, message) });
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
    : error === "wrong_access_level"
      ? `This account does not have ${ADMIN_ACCESS_LEVELS[adminAccessLevel(level)].label} access.`
    : error === "invitation_expired"
      ? "This confirmation or invitation link is invalid or has expired. Request a new link and try again."
      : undefined;
  const notice = message === "email_confirmed"
    ? "Email confirmed. Please log in."
    : message === "email_confirmed_or_used"
      ? "Your email may already be confirmed. Try logging in."
      : undefined;
  const registerHref = nextPath === "/" ? "/applicant/register" : `/applicant/register?next=${encodeURIComponent(nextPath)}`;

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
        <div className="mt-6 text-center text-xs text-slate-500">
          Don&apos;t have an applicant account?{" "}
          <Link className="font-bold text-blue-800 hover:text-blue-900 hover:underline" href={registerHref}>Sign up</Link>
        </div>
        <p className="mt-2 text-center text-[11px] text-slate-500">
          Station personnel?{" "}
          <Link className="font-semibold text-slate-500 hover:text-slate-700 hover:underline" href={switchHref("employee", nextPath)}>Login as Employee</Link>
        </p>
      </ApplicantAuthFrame>
    );
  }

  if (mode === "admin") {
    // Capstone UI sample.html: HR and System Administrators sign in by email with an Access Level.
    return (
      <ApplicantAuthFrame footerNote={null} hero={<AdminAuthHero />} mobilePortalLabel="Admin Portal" portalDotClassName="bg-amber-400" portalPill="Management Portal">
        <div className="mb-6">
          <span className="mb-3 inline-block rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold tracking-wider text-amber-900 uppercase">
            Administrative Access
          </span>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Admin &amp; HR Login</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
            Authorized management portal for HR Personnel Officers and System Administrators.
          </p>
        </div>
        <LoginForm accessLevel={adminAccessLevel(level)} error={errorMessage} mode="admin" nextPath={nextPath} notice={notice} />
        <p className="mt-6 text-center text-[11px] text-slate-500">
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
          Enter your badge number to access your official personnel records, track promotion history and eligibility, file daily attendance, and verify deployment schedules.
        </p>
      </div>
      <LoginForm error={errorMessage} mode={mode} nextPath={nextPath} notice={notice} />
      <p className="mt-6 text-center text-xs text-slate-500">
        Accounts are created by your administrator. <Link className="font-bold text-blue-800 hover:text-blue-900 hover:underline" href={switchHref("applicant", nextPath)}>Login as Applicant</Link>
      </p>
      <p className="mt-2 text-center text-[11px] text-slate-500">
        HR / Admin? <Link className="font-semibold text-slate-500 hover:text-slate-700 hover:underline" href={switchHref("admin", nextPath)}>Admin &amp; HR Login</Link>
      </p>
    </ApplicantAuthFrame>
  );
}
