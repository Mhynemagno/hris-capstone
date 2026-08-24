"use client";

import { ArrowRight, ClipboardCheck, FileText, SearchCheck } from "lucide-react";
import Link from "next/link";

import { PublicJobList } from "@/components/recruitment/public-job-list";
import { PublicSiteHeader } from "@/components/recruitment/public-site-header";

const applicationSteps = [
  {
    description: "Review the responsibilities, requirements, location, and closing date for each role.",
    icon: SearchCheck,
    title: "Find a position",
  },
  {
    description: "Create an applicant account so you can securely manage your application details.",
    icon: FileText,
    title: "Prepare your application",
  },
  {
    description: "Submit your CV and credentials for the opening you are qualified to pursue.",
    icon: ClipboardCheck,
    title: "Apply securely",
  },
];

export function PublicCareersLanding() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicSiteHeader />
      <main>
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_20rem] lg:px-8 lg:py-24">
            <div className="max-w-3xl space-y-6">
              <div aria-hidden="true" className="h-1 w-14 bg-brand-command-red" />
              <p className="text-sm font-semibold tracking-[0.18em] text-blue-200 uppercase">
                San Juan City Police careers
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Serve San Juan with purpose.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                Explore current opportunities to support safer communities with
                the San Juan City Police.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href="/jobs"
                >
                  Explore open positions
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sidebar-border px-5 text-sm font-semibold transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href="/login"
                >
                  Sign in to your account
                </Link>
              </div>
            </div>
            <aside className="self-end rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-6 shadow-lg">
              <p className="text-sm font-semibold">Public recruitment portal</p>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Open positions are published here. Sign in only when you are
                ready to manage an application.
              </p>
            </aside>
          </div>
        </section>

        <section id="open-positions" className="scroll-mt-20">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl space-y-2">
                <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
                  Open positions
                </p>
                <h2 className="text-3xl font-semibold tracking-tight">
                  Find your next role in public service.
                </h2>
                <p className="text-base leading-7 text-muted-foreground">
                  Review currently published roles and their application
                  requirements.
                </p>
              </div>
              <Link
                className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                href="/jobs"
              >
                View all openings
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="mt-8">
              <PublicJobList featured pageSize={3} />
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-semibold tracking-[0.16em] text-primary uppercase">
                How to apply
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                A clear path from opportunity to application.
              </h2>
            </div>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {applicationSteps.map(({ description, icon: Icon, title }, index) => (
                <li className="rounded-xl border border-border bg-card p-6 shadow-sm" key={title}>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <p className="mt-5 text-sm font-semibold text-primary">Step {index + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {description}
                  </p>
                </li>
              ))}
            </ol>
            <Link
              className="mt-8 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              href="/applicant/register"
            >
              Create an applicant account
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p>San Juan City Police recruitment portal</p>
          <div className="flex gap-4">
            <Link className="font-medium text-foreground hover:text-primary" href="/jobs">
              Careers
            </Link>
            <Link className="font-medium text-foreground hover:text-primary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
