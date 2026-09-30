"use client";

import { ArrowRight, Eye, Flag, Megaphone, ShieldCheck, Target } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { PublicJobList } from "@/components/recruitment/public-job-list";
import { PublicSiteHeader } from "@/components/recruitment/public-site-header";

const pnpPrinciples = [
  {
    icon: Eye,
    title: "Vision",
    body: "Imploring the aid of the Almighty, by 2030, we shall be a highly capable, effective and credible police service working in partnership with a responsive community towards the attainment of a safer place to live, work and do business.",
  },
  {
    icon: Target,
    title: "Mission",
    body: "Enforce the law, prevent and control crimes, maintain peace and order, and ensure public safety and internal security with the active support of the community.",
  },
  {
    icon: Flag,
    title: "Motto",
    body: "Serbisyo, Karangalan, Katarungan",
    note: "Service, Honor, Justice",
  },
];

const portalServices = [
  "Personnel records, deployments and promotions",
  "Leave requests and attendance",
  "Recruitment and online applications",
];

function BrandLogos({ priority = false, size = 80 }: { priority?: boolean; size?: number }) {
  return (
    <div className="flex items-center gap-4">
      <Image alt="San Juan City Police Station logo" className="object-contain drop-shadow-md" height={size} priority={priority} src="/san-juan-police-logo.png" style={{ height: size, width: size }} width={size} />
      <span aria-hidden="true" className="h-12 w-px bg-white/20" />
      {/* The wordmark is dark blue, so it sits on a light chip to stay legible on navy. */}
      <span className="rounded-xl bg-white p-2 shadow-md">
        <Image alt="Bagong Pilipinas logo" className="w-auto object-contain" height={size - 16} priority={priority} src="/bagong-pilipinas-logo.png" style={{ height: size - 16 }} width={Math.round(((size - 16) * 330) / 308)} />
      </span>
    </div>
  );
}

export function PublicCareersLanding() {
  return (
    <div className="min-h-dvh bg-background">
      <PublicSiteHeader />
      <main>
        <section className="bg-sidebar text-sidebar-foreground">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:px-8">
            <div className="max-w-3xl space-y-6">
              <BrandLogos priority />
              <div aria-hidden="true" className="h-1 w-14 bg-brand-command-red" />
              <p className="text-sm font-semibold tracking-[0.18em] text-sidebar-ring uppercase">
                Philippine National Police · San Juan City Police Station
              </p>
              <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                Serve San Juan with purpose.
              </h1>
              <p className="max-w-2xl text-lg leading-8 text-slate-300">
                The official portal of the San Juan City Police Station for its personnel and for everyone who wants
                to join the service.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href="#job-openings"
                >
                  Explore job openings
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-sidebar-border px-5 text-sm font-semibold transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  href="/login?as=employee"
                >
                  Employee login
                </Link>
              </div>
            </div>
            <aside className="rounded-2xl border border-sidebar-border bg-sidebar-accent/70 p-6 shadow-lg">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck aria-hidden="true" className="size-4 text-sidebar-ring" />
                One portal for the station
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                {portalServices.map((service) => (
                  <li className="flex gap-2" key={service}>
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sidebar-ring" />
                    {service}
                  </li>
                ))}
              </ul>
            </aside>
          </div>
        </section>

        <section aria-labelledby="pnp-principles-heading" className="border-b border-border bg-muted/50">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="max-w-2xl space-y-2">
              <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Philippine National Police</p>
              <h2 className="text-3xl font-semibold tracking-tight" id="pnp-principles-heading">
                Our vision, mission and motto
              </h2>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {pnpPrinciples.map(({ body, icon: Icon, note, title }) => (
                <article className="rounded-xl border border-border bg-card p-6 shadow-sm" key={title}>
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  {note ? (
                    <>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">{body}</p>
                      <p className="mt-1 text-base text-muted-foreground">{note}</p>
                    </>
                  ) : (
                    <p className="mt-2 text-base leading-7 text-muted-foreground">{body}</p>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="job-openings-heading" className="scroll-mt-20" id="job-openings">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
              <div className="flex flex-col gap-4 border-b border-border/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl space-y-2">
                  <p className="flex items-center gap-2 text-sm font-semibold tracking-[0.18em] text-brand-command-red uppercase">
                    <Megaphone aria-hidden="true" className="size-4" />
                    Now hiring
                  </p>
                  <h2 className="text-3xl font-semibold tracking-tight" id="job-openings-heading">Apply Now!</h2>
                  <p className="text-base leading-7 text-muted-foreground">
                    Open a posting to see its requirements, then sign up and apply online.
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
              <div className="mt-6">
                <PublicJobList featured pageSize={3} />
              </div>
              <p className="mt-6 text-sm text-muted-foreground">
                New applicant?{" "}
                <Link className="font-semibold text-primary underline-offset-4 hover:underline" href="/applicant/register">
                  Create an applicant account
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer className="bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <BrandLogos size={48} />
            <p className="text-slate-300">San Juan City Police Station</p>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            <Link className="inline-flex min-h-11 items-center font-medium hover:text-sidebar-ring" href="/login?as=employee">
              Login as Employee
            </Link>
            <Link className="inline-flex min-h-11 items-center font-medium hover:text-sidebar-ring" href="/login?as=applicant">
              Login as Applicant
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
