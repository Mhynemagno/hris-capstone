import { Megaphone } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { PrivacyPolicyDialog } from "@/components/auth/privacy-policy-dialog";
import type { RecruitmentNotice } from "@/lib/recruitment/recruitment-notice";

/**
 * The applicant login and registration card (Capstone UI loginapp.html): the form on the left and the
 * station's dark hero with the live Recruitment Notice on the right. Stacks on phones.
 */
export function ApplicantAuthFrame({ children, notice }: { children: ReactNode; notice: RecruitmentNotice }) {
  return (
    <main className="capstone-ui flex min-h-svh items-center justify-center bg-slate-900 p-4 font-sans sm:p-6 lg:p-8">
      <div className="grid w-full max-w-[1024px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl lg:h-[620px] lg:grid-cols-12">
        {/* LEFT SIDE: FORM (5 COLS) */}
        <div className="flex h-full flex-col justify-between bg-white p-8 sm:p-10 lg:col-span-5 lg:overflow-y-auto">
          <div>
            {/* MOBILE LOGO HEADER */}
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <div className="flex size-10 items-center justify-center rounded-lg bg-slate-900">
                <Image alt="" className="size-8 object-contain" height={32} src="/san-juan-police-logo.png" width={32} />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900 uppercase">PNP San Juan City</p>
                <p className="text-[10px] text-slate-500 uppercase">Recruitment Portal</p>
              </div>
            </div>
            {children}
          </div>

          {/* FOOTER NOTE */}
          <div className="mt-8 border-t border-slate-100 pt-4 text-center text-[11px] text-slate-400">
            San Juan City PNP Online Recruitment &amp; Applicant Portal System
          </div>
        </div>

        {/* RIGHT SIDE: BRANDING HERO PANEL (7 COLS) */}
        <div className="relative flex min-h-[420px] flex-col justify-between overflow-hidden bg-slate-950 p-10 text-white lg:col-span-7 lg:h-full">
          <div aria-hidden="true" className="absolute inset-0 z-0 bg-gradient-to-t from-slate-950 via-slate-900/90 to-slate-950/80" />

          {/* TOP BRANDING & LOGOS */}
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl border border-blue-500/30 bg-blue-900/80 shadow-lg backdrop-blur-md">
                <Image alt="San Juan City Police Station logo" className="size-10 object-contain" height={40} src="/san-juan-police-logo.png" width={40} />
              </div>
              <div>
                <p className="text-sm font-extrabold tracking-wider text-white uppercase">SAN JUAN CITY POLICE STATION</p>
                <p className="text-[10px] font-semibold tracking-widest text-amber-400 uppercase">Eastern Police District • NCRPO</p>
              </div>
            </div>

            {/* OFFICIAL BADGE PILL */}
            <div className="hidden items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 backdrop-blur-md sm:flex">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-[10px] font-bold tracking-wider text-slate-200 uppercase">Applicant Portal</span>
            </div>
          </div>

          {/* MIDDLE HERO MOTTO / SLOGAN */}
          <div className="relative z-10 my-auto py-6">
            <div className="mb-4 inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold tracking-widest text-amber-400 uppercase">
              <span>Service</span> • <span>Honor</span> • <span>Justice</span>
            </div>

            <h2 className="text-3xl leading-tight font-extrabold text-white">To Serve and Protect.</h2>

            <p className="mt-3 max-w-md text-xs leading-relaxed font-normal text-slate-300">
              Welcome to the official recruitment tracking system of the San Juan City Police Station. Monitor your application status, agility tests, and board evaluations in real time.
            </p>

            {/* RECRUITMENT NOTICE */}
            <div className="mt-6 max-w-md rounded-xl border border-slate-800/80 bg-slate-900/80 p-4 backdrop-blur-md">
              <p className="mb-1 flex items-center gap-2 text-xs font-bold text-amber-400">
                <Megaphone aria-hidden="true" className="size-3.5" /> Recruitment Notice
              </p>
              <p className="text-[11px] leading-snug text-slate-300">
                {notice
                  ? <>Current Hiring Pool for <strong>{notice.title}</strong> is now open for verified candidates.</>
                  : "There is no active recruitment at the moment. Please check back for new openings."}
              </p>
            </div>
          </div>

          {/* BOTTOM FOOTER */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800/80 pt-6 text-[11px] text-slate-400">
            <p>© {new Date().getFullYear()} San Juan City Police Station</p>
            <div className="flex items-center gap-4">
              <PrivacyPolicyDialog />
              <span aria-hidden="true">•</span>
              <Link className="rounded transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60" href="/#contact">Help Desk</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
