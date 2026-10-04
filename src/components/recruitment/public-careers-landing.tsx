"use client";

import { ArrowRight, BriefcaseBusiness, CircleCheck, Eye, Flag, GraduationCap, HandHeart, LockKeyhole, Search, ShieldCheck, Sparkles, Target, UserRoundCheck } from "lucide-react";
import Link from "next/link";

import { BrandLogos } from "@/components/public-site/brand-logos";
import { LandingAnnouncements } from "@/components/public-site/landing-announcements";
import { LandingContacts } from "@/components/public-site/landing-contacts";
import { LandingFaqs } from "@/components/public-site/landing-faqs";
import { PortalHeader } from "@/components/public-site/portal-header";
import { SectionIntro } from "@/components/public-site/section-intro";
import { PublicJobList } from "@/components/recruitment/public-job-list";
import { useVisibleContacts } from "@/hooks/use-public-site";

const liftOnHover = "motion-safe:transition-transform motion-safe:duration-300 motion-safe:hover:-translate-y-1";
const focusRing = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

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
  { icon: Flag, title: "Motto", body: "Serbisyo, Karangalan, Katarungan", note: "Service, Honor, Justice" },
];

const personnelFeatures = ["Personnel records and service history", "Leave requests", "Attendance", "Deployments", "Promotion eligibility"];
const applicantFeatures = ["Browse open positions and their requirements", "Apply online with your saved documents", "Track the status of your application"];

const benefits = [
  { icon: HandHeart, title: "Serve your community", body: "Protect and serve the people of San Juan alongside a station that works closely with its community." },
  { icon: GraduationCap, title: "Training and growth", body: "Build your skills through police training and grow your career through the PNP's promotion system." },
  { icon: ShieldCheck, title: "A stable public-service career", body: "Join a uniformed public service with the benefits the law provides to PNP personnel." },
];

function FeatureList({ items, tone }: { items: readonly string[]; tone: "gold" | "teal" }) {
  return (
    <ul className="mt-6 space-y-2.5 text-base text-slate-300">
      {items.map((item) => (
        <li className="flex items-start gap-2.5" key={item}>
          <CircleCheck aria-hidden="true" className={`mt-1 size-4 shrink-0 ${tone === "gold" ? "text-cta" : "text-primary"}`} />
          {item}
        </li>
      ))}
    </ul>
  );
}

export function PublicCareersLanding() {
  const contacts = useVisibleContacts();
  // A failed or empty contact list hides the section and its header link instead of showing an error.
  const visibleContacts = contacts.data ?? [];
  const showContact = visibleContacts.length > 0;

  return (
    <div className="dark portal-grid min-h-dvh bg-background text-foreground">
      <PortalHeader showContact={showContact} />
      <main>
        <section aria-labelledby="hero-heading" className="mx-auto max-w-4xl px-4 pt-14 pb-10 text-center sm:px-6 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-cta/30 bg-cta/10 px-4 py-1.5 text-sm font-semibold tracking-wide text-cta uppercase">
            <Sparkles aria-hidden="true" className="size-4" />
            Official portal of the San Juan City Police Station
          </p>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl" id="hero-heading">Serve San Juan with purpose.</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            One portal for station personnel, job applicants, and everyone who wants to know what is happening at the station.
          </p>
        </section>

        <section aria-labelledby="portals-heading" className="scroll-mt-24 px-4 pb-16 sm:px-6 lg:px-8" id="portals">
          <h2 className="sr-only" id="portals-heading">Portals</h2>
          <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-2">
            <article aria-labelledby="personnel-portal-heading" className={`glass-panel flex flex-col justify-between rounded-2xl border border-cta/15 border-t-4 border-t-cta p-6 sm:p-8 ${liftOnHover}`}>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-cta/40 bg-background text-cta"><UserRoundCheck aria-hidden="true" className="size-7" /></span>
                  <span className="rounded-full border border-cta/30 bg-cta/10 px-3 py-1 text-sm font-bold tracking-wide text-cta uppercase">Station personnel</span>
                </div>
                <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl" id="personnel-portal-heading">Personnel Portal</h3>
                <p className="mt-2 text-base leading-7 text-slate-300">Self-service for San Juan City Police Station personnel.</p>
                <FeatureList items={personnelFeatures} tone="gold" />
              </div>
              <div className="mt-8 border-t border-border pt-5">
                <Link className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cta px-6 text-base font-bold text-cta-foreground transition-colors hover:bg-cta/90 ${focusRing}`} href="/login?as=employee">
                  <LockKeyhole aria-hidden="true" className="size-4" />
                  Sign in as personnel
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              </div>
            </article>

            <article aria-labelledby="applicant-portal-heading" className={`glass-panel flex flex-col justify-between rounded-2xl border border-primary/15 border-t-4 border-t-primary p-6 sm:p-8 ${liftOnHover}`}>
              <div>
                <div className="flex items-center justify-between gap-4">
                  <span className="flex size-14 items-center justify-center rounded-2xl border border-primary/40 bg-background text-primary"><BriefcaseBusiness aria-hidden="true" className="size-7" /></span>
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-bold tracking-wide text-primary uppercase">Careers</span>
                </div>
                <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-white sm:text-3xl" id="applicant-portal-heading">Applicant &amp; Career Portal</h3>
                <p className="mt-2 text-base leading-7 text-slate-300">Find an opening at the station and apply online.</p>
                <FeatureList items={applicantFeatures} tone="teal" />
              </div>
              <div className="mt-8 grid gap-3 border-t border-border pt-5 sm:grid-cols-2">
                <Link className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-base font-bold text-primary-foreground transition-colors hover:bg-primary/85 ${focusRing}`} href="/jobs">
                  <Search aria-hidden="true" className="size-4" />
                  View job openings
                </Link>
                <Link className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-base font-bold text-white transition-colors hover:bg-muted ${focusRing}`} href="/login?as=applicant&next=/applicant/applications">
                  Check application status
                </Link>
              </div>
            </article>
          </div>
        </section>

        <section aria-labelledby="job-openings-heading" className="scroll-mt-24 border-t border-border/80" id="job-openings">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <SectionIntro description="Open a posting to see its requirements, then sign up and apply online." eyebrow="Now hiring" id="job-openings-heading" title="Latest job openings" />
              <Link className={`inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-cta underline-offset-4 hover:underline ${focusRing}`} href="/jobs">
                View all openings
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="mt-8">
              <PublicJobList featured pageSize={3} />
            </div>
            <p className="mt-6 text-sm text-slate-300">
              New applicant?{" "}
              <Link className="font-semibold text-cta underline-offset-4 hover:underline" href="/applicant/register">Create an applicant account</Link>
            </p>
          </div>
        </section>

        <LandingAnnouncements />

        <section aria-labelledby="about-heading" className="scroll-mt-24 border-t border-border/80" id="about">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-12 lg:items-center lg:px-8">
            <div className="lg:col-span-5">
              <SectionIntro
                description="The San Juan City Police Station keeps the peace in San Juan City as part of the Philippine National Police. This portal brings its personnel services, recruitment, and public information together."
                eyebrow="Philippine National Police"
                id="about-heading"
                title="About the station"
              />
            </div>
            <div className="glass-panel rounded-2xl border border-border p-6 lg:col-span-7">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                <ShieldCheck aria-hidden="true" className="size-5 text-cta" />
                Our vision, mission and motto
              </h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {pnpPrinciples.map(({ body, icon: Icon, note, title }) => (
                  <article className={`rounded-xl border border-border bg-background/80 p-4 ${title === "Vision" ? "sm:col-span-2" : ""}`} key={title}>
                    <h4 className="flex items-center gap-2 text-base font-bold text-cta">
                      <Icon aria-hidden="true" className="size-4" />
                      {title}
                    </h4>
                    {note ? (
                      <>
                        <p className="mt-1 text-lg font-semibold text-white">{body}</p>
                        <p className="text-sm text-slate-300">{note}</p>
                      </>
                    ) : (
                      <p className="mt-1 text-sm leading-6 text-slate-300">{body}</p>
                    )}
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="why-join-heading" className="scroll-mt-24 border-t border-border/80" id="why-join">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
            <SectionIntro align="center" eyebrow="A calling to serve" id="why-join-heading" title="Why join the station?" />
            <div className="mx-auto mt-10 grid max-w-6xl gap-6 md:grid-cols-3">
              {benefits.map(({ body, icon: Icon, title }) => (
                <article className={`glass-panel rounded-2xl border border-border p-6 ${liftOnHover}`} key={title}>
                  <span className="flex size-12 items-center justify-center rounded-xl bg-cta/10 text-cta"><Icon aria-hidden="true" className="size-6" /></span>
                  <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
                  <p className="mt-2 text-base leading-7 text-slate-300">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <LandingFaqs />

        {showContact ? <LandingContacts contacts={visibleContacts} /> : null}
      </main>

      <footer className="border-t border-border bg-sidebar text-sidebar-foreground">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 text-sm sm:px-6 lg:px-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <BrandLogos size={48} />
              <p className="text-slate-300">San Juan City Police Station</p>
            </div>
            <nav aria-label="Sign in">
              <ul className="flex flex-wrap gap-x-5 gap-y-1">
                <li><Link className="inline-flex min-h-11 items-center font-medium hover:text-cta" href="/login?as=employee">Login as Employee</Link></li>
                <li><Link className="inline-flex min-h-11 items-center font-medium hover:text-cta" href="/login?as=applicant">Login as Applicant</Link></li>
              </ul>
            </nav>
          </div>
          <p className="text-slate-300">Personal information submitted through this portal is protected under the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
        </div>
      </footer>
    </div>
  );
}
