"use client";

import { Badge, ChevronDown, Eye, EyeOff, Lock, Mail, ShieldUser } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { AdminAccessLevel } from "@/schemas/auth";

type LoginFormProps = {
  error?: string;
  notice?: string;
  /**
   * Which login the visitor chose; kept so a failed attempt returns to the same page.
   * Employees sign in with their badge number, applicants with their email address, and HR / SysAd with either.
   */
  mode: "employee" | "applicant" | "admin";
  /** The Admin & HR Login's preselected Access Level (Capstone UI sample.html). */
  accessLevel?: AdminAccessLevel;
  nextPath: string;
};

const applicantInputClassName =
  "w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-transparent focus:bg-white focus:ring-2 focus:ring-blue-800 focus:outline-none";

/** Capstone UI loginapp.html / sample.html: (Access Level,) email, password with show/hide, Forgot password?, Remember me, Login. */
function CapstoneFields({ pending, accessLevel }: { pending: boolean; accessLevel?: AdminAccessLevel }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <>
      {accessLevel ? (
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700" htmlFor="login-access-level">Access Level</label>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-500">
              <ShieldUser aria-hidden="true" className="size-4" />
            </div>
            <select
              className={`${applicantInputClassName} cursor-pointer appearance-none pr-10 pl-10`}
              defaultValue={accessLevel}
              id="login-access-level"
              name="access_level"
            >
              <option value="hr">HR Admin</option>
              <option value="sysad">System Administrator</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-500">
              <ChevronDown aria-hidden="true" className="size-3.5" />
            </div>
          </div>
        </div>
      ) : null}
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="login-identifier">{accessLevel ? "Email Address or Badge Number" : "Email Address"}</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Mail aria-hidden="true" className="size-4" />
          </div>
          <input
            autoComplete={accessLevel ? "username" : "email"}
            className={`${applicantInputClassName} pr-4 pl-10`}
            id="login-identifier"
            inputMode={accessLevel ? "text" : "email"}
            name="identifier"
            placeholder={accessLevel ? "juan.delacruz@gmail.com or 0-12345" : "juan.delacruz@email.com"}
            required
            type={accessLevel ? "text" : "email"}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="login-password">Password</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
            <Lock aria-hidden="true" className="size-4" />
          </div>
          <input
            autoComplete="current-password"
            className={`${applicantInputClassName} pr-10 pl-10`}
            id="login-password"
            name="password"
            placeholder="••••••••••••"
            required
            type={passwordVisible ? "text" : "password"}
          />
          <button
            aria-label={passwordVisible ? "Hide password" : "Show password"}
            aria-pressed={passwordVisible}
            className="absolute inset-y-0 right-0 flex items-center rounded-r-xl pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-slate-700"
            onClick={() => setPasswordVisible((visible) => !visible)}
            type="button"
          >
            {passwordVisible ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
          </button>
        </div>

        <div className="mt-2 text-right">
          <Link className="text-[11px] font-semibold text-blue-800 hover:text-blue-900 hover:underline" href="/forgot-password">
            Forgot password?
          </Link>
        </div>
      </div>

      <div className="flex items-center pt-1">
        <input
          className="size-4 cursor-pointer rounded border-slate-300 text-blue-800 accent-blue-800 focus:ring-blue-800"
          defaultChecked
          id="login-remember"
          name="remember"
          type="checkbox"
        />
        <label className="ml-2 cursor-pointer text-xs font-medium text-slate-600 select-none" htmlFor="login-remember">
          Remember me on this device
        </label>
      </div>

      <button
        className="mt-2 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-md transition-all duration-200 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        <span>{pending ? "Signing in…" : "Login"}</span>
      </button>
    </>
  );
}

/** Employee badge sign-in styled from emplogin.html, retaining the native auth POST contract. */
function EmployeeFields({ pending }: { pending: boolean }) {
  const [passwordVisible, setPasswordVisible] = useState(false);
  return (
    <>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="login-identifier">Badge Number</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"><Badge aria-hidden="true" className="size-4" /></div>
          <input autoComplete="username" className={`${applicantInputClassName} pr-4 pl-10`} id="login-identifier" inputMode="text" name="identifier" placeholder="0-12345" required type="text" />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700" htmlFor="login-password">Password</label>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"><Lock aria-hidden="true" className="size-4" /></div>
          <input autoComplete="current-password" className={`${applicantInputClassName} pr-10 pl-10`} id="login-password" name="password" placeholder="••••••••••••" required type={passwordVisible ? "text" : "password"} />
          <button aria-label={passwordVisible ? "Hide password" : "Show password"} aria-pressed={passwordVisible} className="absolute inset-y-0 right-0 flex items-center rounded-r-xl pr-3.5 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:text-slate-700" onClick={() => setPasswordVisible((visible) => !visible)} type="button">
            {passwordVisible ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
          </button>
        </div>
        <div className="mt-2 text-right"><Link className="text-[11px] font-semibold text-blue-800 hover:text-blue-900 hover:underline" href="/forgot-password">Forgot your password?</Link></div>
      </div>
      <div className="flex items-center pt-1">
        <input className="size-4 cursor-pointer rounded border-slate-300 text-blue-800 accent-blue-800 focus:ring-blue-800" id="login-remember" name="remember" type="checkbox" />
        <label className="ml-2 cursor-pointer text-xs font-medium text-slate-600 select-none" htmlFor="login-remember">Remember me on this device</label>
      </div>
      <button className="mt-2 flex w-full items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-md transition-all duration-200 hover:bg-blue-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={pending} type="submit">
        {pending ? "Signing in…" : "Login"}
      </button>
    </>
  );
}

export function LoginForm({ accessLevel, error, mode, nextPath, notice }: LoginFormProps) {
  const [pending, setPending] = useState(false);

  useEffect(() => {
    // Returning via the back button can restore this page from the bfcache with the pending state still set.
    const reset = () => setPending(false);
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, []);

  if (mode === "applicant" || mode === "admin") {
    return (
      <form
        action="/auth/login"
        aria-busy={pending}
        className="space-y-4"
        method="post"
        noValidate
        // Do not preventDefault: the native POST to /auth/login sets the session cookies and redirects.
        onSubmit={() => setPending(true)}
      >
        <input name="next" type="hidden" value={nextPath} />
        <input name="as" type="hidden" value={mode} />
        {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status">{notice}</p> : null}
        {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{error}</p> : null}
        <CapstoneFields accessLevel={mode === "admin" ? (accessLevel ?? "hr") : undefined} pending={pending} />
      </form>
    );
  }

  return (
    <form
      action="/auth/login"
      aria-busy={pending}
      className="space-y-4"
      method="post"
      noValidate
      // Do not preventDefault: the native POST to /auth/login sets the session cookies and redirects.
      onSubmit={() => setPending(true)}
    >
      <input name="next" type="hidden" value={nextPath} />
      <input name="as" type="hidden" value={mode} />
      {notice ? <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status">{notice}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{error}</p> : null}
      <EmployeeFields pending={pending} />
    </form>
  );
}
