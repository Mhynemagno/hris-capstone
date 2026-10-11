"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  CircleDot,
  CircleHelp,
  Clock,
  ExternalLink,
  Eye,
  Heart,
  IdCard,
  Landmark,
  Lock,
  MapPin,
  MapPinned,
  Newspaper,
  Phone,
  Shield,
  ShieldHalf,
  Target,
  Trophy,
  UserCog,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { usePublishedAnnouncements } from "@/hooks/use-public-site";
import { usePublishedJobs } from "@/hooks/use-recruitment";
import { formatDate } from "@/lib/format-date";
import { stripAnnouncementMarkup } from "@/lib/public-site/announcement-markup";
import { announcementCategoryLabel } from "@/schemas/public-site";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

// Copied 1:1 from the client's landing.html (Final Changes PDF, Oct 2026): PNP navy, San Juan red, gold.
// Small red or grey text on dark grounds uses the mock's lighter red / slate-400 so it passes WCAG AA.
const focusRing = "focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#CE1126]/50";
const STATION_MAP_QUERY = "San Juan City Police Station, Santolan Road cor. Col. Bonny Serrano Avenue, San Juan City, Metro Manila";

const regionalOffices = [
  ["NCRPO", "National Capital Region Police Office"],
  ["PRO COR", "Police Regional Office Cordillera"],
  ["PRO 1", "Region I - Ilocos Region"],
  ["PRO 2", "Region II - Cagayan Valley"],
  ["PRO 3", "Region III - Central Luzon"],
  ["PRO 4A", "Region IV-A - Calabarzon"],
  ["PRO 4B", "Region IV-B - Mimaropa"],
  ["PRO 5", "Region V - Bicol Region"],
  ["PRO 6", "Region VI - Western Visayas"],
  ["PRO NIR", "Negros Island Region"],
  ["PRO 7", "Region VII - Central Visayas"],
  ["PRO 8", "Region VIII - Eastern Visayas"],
  ["PRO 9", "Region IX - Zamboanga Peninsula"],
  ["PRO 10", "Region X - Northern Mindanao"],
  ["PRO 11", "Region XI - Davao Region"],
  ["PRO 12", "Region XII - Soccsksargen"],
  ["PRO 13", "Region XIII - Caraga"],
  ["PRO BAR", "Bangsamoro Autonomous Region in Muslim Mindanao"],
] as const;

const districtOffices = [
  ["EPD", "Eastern Police District (Mandaluyong, Marikina, Pasig, San Juan)"],
  ["MPD", "Manila Police District (City of Manila)"],
  ["NPD", "Northern Police District (Caloocan, Malabon, Navotas, Valenzuela)"],
  ["QCPD", "Quezon City Police District (Quezon City)"],
  ["SPD", "Southern Police District (Las Piñas, Makati, Muntinlupa, Parañaque, Pateros, Pasay, Taguig)"],
] as const;

const commissionedOfficers = [
  ["PGEN", "Police General"],
  ["PLTGEN", "Police Lieutenant General"],
  ["PMGEN", "Police Major General"],
  ["PBGEN", "Police Brigadier General"],
  ["PCOL", "Police Colonel"],
  ["PLTCOL", "Police Lieutenant Colonel"],
  ["PMAJ", "Police Major"],
  ["PCPT", "Police Captain"],
  ["PLT", "Police Lieutenant"],
] as const;

const nonCommissionedOfficers = [
  ["PEMS", "Police Executive Master Sergeant"],
  ["PCMS", "Police Chief Master Sergeant"],
  ["PSMS", "Police Senior Master Sergeant"],
  ["PMSG", "Police Master Sergeant"],
  ["PSSG", "Police Staff Sergeant"],
  ["PCPL", "Police Corporal"],
  ["PAT", "Patrolman / Patrolwoman"],
] as const;

const coreValues = [
  ["1. Maka-Diyos", "(God Fearing)", "All PNP Personnel must believe in God, who is the Creator of all men and everything on the planet. Seek His guidance in the performance of sworn duties and honor Him at all times."],
  ["2. Maka-Bayan", "(Nationalistic)", "All PNP Personnel must respect and uphold the Constitution, the laws of the land and the applicable rules and regulations. Recognize the legitimacy and authority of the leadership and obey legal orders of the superior officers."],
  ["3. Maka-Tao", "(Humane)", "Committing to the service of my fellowmen over and above the personal interest."],
  ["4. Maka-Kalikasan", "(Environment-friendly)", "Inhibiting from extravagance and ostentatious display of material things. Respect for private and public properties and prevent others from destroying them. And finally, shall help protect the environment and conserve nature to maintain ecological balance."],
] as const;

const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: "Who can apply for recruitment in San Juan City Police Station?",
    answer: "Filipino citizens with good moral character, physically and mentally fit, possessing Civil Service or PNP Board eligibility.",
  },
  {
    question: "What documents are required for application submission?",
    answer: `${APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ label }) => label).join(", ")}.`,
  },
  {
    question: "How can I track my recruitment application status?",
    answer: "Use the Track Status box inside the \"Recruitment Openings\" tab or log in through the Applicant Portal.",
  },
];

const tabs = [
  { value: "about", label: "About PNP", icon: Building2 },
  { value: "news", label: "Advisories & News", icon: Newspaper },
  { value: "faq", label: "Frequently Asked Questions (FAQ)", icon: CircleHelp },
  { value: "recruitment", label: "Recruitment Openings", icon: BriefcaseBusiness },
] as const;

const categoryBadge: Record<string, string> = {
  advisory: "bg-amber-100 text-amber-800",
  news: "bg-slate-100 text-slate-800",
  event: "bg-[#CE1126]/10 text-[#CE1126]",
  recruitment: "bg-[#0B1A30]/10 text-[#0B1A30]",
};

function DotList({ items }: { items: readonly (readonly [string, string])[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 text-slate-700 md:grid-cols-2">
      {items.map(([code, name]) => (
        <li className="flex items-start" key={code}>
          <CircleDot aria-hidden="true" className="mt-1 mr-2 size-2 shrink-0 text-[#CE1126]" />
          <span><strong>{code}</strong> – {name}</span>
        </li>
      ))}
    </ul>
  );
}

function AboutItem({ children, icon: Icon, iconClass, title }: { title: string; icon: typeof Heart; iconClass: string; children: ReactNode }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <summary className={`flex w-full cursor-pointer list-none items-center justify-between p-5 text-left text-xs font-extrabold tracking-wider text-slate-800 uppercase transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden ${focusRing}`}>
        <span className="flex items-center">
          <span className={`mr-3 flex size-7 items-center justify-center rounded-lg text-xs font-black ${iconClass}`}>
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
          <span>{title}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-5 text-xs leading-relaxed text-slate-600">{children}</div>
    </details>
  );
}

function AboutTab() {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-800 bg-[#0B1A30] p-8 text-white shadow-xl lg:col-span-1">
          <Shield aria-hidden="true" className="pointer-events-none absolute -right-6 -bottom-6 size-32 text-white/5" fill="currentColor" />
          <div>
            <span className="mb-2 block text-xs font-bold tracking-widest text-[#EF4444] uppercase">Philippine National Police</span>
            <h3 className="mb-4 text-3xl leading-tight font-black uppercase">San Juan City Station</h3>
            <p className="mb-6 text-xs leading-relaxed font-normal text-slate-300">
              The primary mission of the San Juan City Police Station is to maintain peace and order throughout the City of San Juan. To promote anti-criminality awareness and keep the public safe, the station actively connects with citizens through social media and its online information system.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:col-span-2">
          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/60 p-8 shadow-sm transition-shadow hover:shadow-md">
            <div>
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#CE1126]/10 text-xl font-bold text-[#CE1126]">
                <Eye aria-hidden="true" className="size-5" />
              </div>
              <h4 className="mb-3 text-base font-black tracking-wide text-slate-900 uppercase">Vision</h4>
              <p className="text-xs leading-relaxed font-normal text-slate-600">
                Imploring the aid of the Almighty, by 2030, we shall be a highly capable, effective, and credible police service working in partnership with a responsive community towards the attainment of a safer place to live, work, and do business.
              </p>
            </div>
            <div className="mt-6 border-t border-slate-200/60 pt-6">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">PNP Roadmap 2030</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-slate-50/60 p-8 shadow-sm transition-shadow hover:shadow-md">
            <div>
              <div className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-[#0B1A30]/10 text-xl font-bold text-[#0B1A30]">
                <Target aria-hidden="true" className="size-5" />
              </div>
              <h4 className="mb-3 text-base font-black tracking-wide text-slate-900 uppercase">Mission</h4>
              <p className="text-xs leading-relaxed font-normal text-slate-600">
                Enforce the law, prevent and control crimes, maintain peace and order, and ensure public safety and internal security with the active support of the community.
              </p>
            </div>
            <div className="mt-6 border-t border-slate-200/60 pt-6">
              <span className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">Public Service Mandate</span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-8">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h4 className="flex items-center text-sm font-extrabold tracking-wider text-slate-900 uppercase">
            <Landmark aria-hidden="true" className="mr-2 size-4 text-[#CE1126]" /> About PNP
          </h4>
          <span className="text-[10px] font-bold text-slate-500 uppercase">Click Arrow to Expand</span>
        </div>

        <AboutItem icon={Heart} iconClass="bg-[#CE1126]/10 text-[#CE1126]" title="PNP Core Values">
          <p className="font-bold text-slate-800 italic">Police Service is a noble profession which demands from its members specialized knowledge and skills, as well as standards of ethics and morality.</p>
          <div className="space-y-3 pt-2">
            {coreValues.map(([name, gloss, body]) => (
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm" key={name}>
                <h5 className="mb-1 text-xs font-bold tracking-wide text-slate-900 uppercase"><span className="text-[#CE1126]">{name}</span> {gloss}</h5>
                <p className="leading-relaxed text-slate-600">{body}</p>
              </div>
            ))}
          </div>
        </AboutItem>

        <AboutItem icon={MapPinned} iconClass="bg-[#CE1126]/10 text-[#CE1126]" title="PNP Regional Offices">
          <DotList items={regionalOffices} />
        </AboutItem>

        <AboutItem icon={Building2} iconClass="bg-[#0B1A30]/10 text-[#0B1A30]" title="NCRPO District Offices">
          <DotList items={districtOffices} />
        </AboutItem>

        <AboutItem icon={Trophy} iconClass="bg-emerald-100 text-emerald-800" title="PNP Rank Structure">
          <div>
            <p className="mb-2 text-[11px] font-black tracking-wider text-slate-900 uppercase">Commissioned Officers</p>
            <DotList items={commissionedOfficers} />
          </div>
          <div className="border-t border-slate-200/80 pt-2">
            <p className="mb-2 text-[11px] font-black tracking-wider text-slate-900 uppercase">Non-Commissioned Officers</p>
            <DotList items={nonCommissionedOfficers} />
          </div>
        </AboutItem>
      </div>
    </div>
  );
}

function NewsTab() {
  const announcements = usePublishedAnnouncements(6);
  const rows = announcements.data ?? [];
  if (announcements.isLoading) return <p className="text-xs text-slate-500" role="status">Loading announcements…</p>;
  if (announcements.error) return <p className="text-xs text-[#CE1126]" role="alert">Announcements could not be loaded. Please try again later.</p>;
  if (!rows.length) return <p className="rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600" role="status">No announcements right now.</p>;
  return (
    <ul className="grid grid-cols-1 gap-6 md:grid-cols-3">
      {rows.map((announcement) => (
        <li key={announcement.id}>
          <article aria-labelledby={`announcement-${announcement.id}-title`} className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-md">
            <span className={`mb-3 inline-block w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${categoryBadge[announcement.category] ?? categoryBadge.news}`}>
              {announcementCategoryLabel(announcement.category)}
            </span>
            {announcement.published_at ? (
              <p className="mb-1 text-[10px] font-semibold text-slate-500"><time dateTime={announcement.published_at}>{formatDate(announcement.published_at)}</time></p>
            ) : null}
            <h4 className="mb-2 text-sm font-bold text-slate-900 uppercase [overflow-wrap:anywhere]" id={`announcement-${announcement.id}-title`}>{announcement.title}</h4>
            <p className="flex-1 text-xs leading-relaxed text-slate-600 [overflow-wrap:anywhere]">{stripAnnouncementMarkup(announcement.summary)}</p>
            <Link
              aria-label={`Read more about ${announcement.title}`}
              className={`mt-4 inline-flex w-fit items-center gap-1 rounded text-xs font-extrabold text-[#CE1126] hover:underline ${focusRing}`}
              href={`/announcements/${announcement.id}`}
            >
              Read more <ArrowRight aria-hidden="true" className="size-3" />
            </Link>
          </article>
        </li>
      ))}
    </ul>
  );
}

function FaqTab() {
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {faqs.map(({ answer, question }) => (
        <details className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" key={question}>
          <summary className={`flex w-full cursor-pointer list-none items-center justify-between gap-3 p-5 text-left text-sm font-bold text-slate-900 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden ${focusRing}`}>
            <span>{question}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 bg-slate-50/50 p-5 text-xs leading-relaxed text-slate-600">{answer}</div>
        </details>
      ))}
    </div>
  );
}

function RecruitmentTab() {
  const jobs = usePublishedJobs({ page: 1, pageSize: 4 });
  const rows = jobs.data?.rows ?? [];
  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 rounded-2xl border border-red-100 bg-red-50 p-6 md:flex-row md:items-center">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 uppercase">Active Recruitment Drives</h3>
          <p className="text-xs text-slate-600">Apply online for uniform and non-uniform positions at San Juan City Police Station.</p>
        </div>
        {/* Application status lives behind the applicant login, so tracking opens it there. */}
        <form action="/login" className="flex w-full items-center gap-2 md:w-auto" method="get">
          <input name="as" type="hidden" value="applicant" />
          <input name="next" type="hidden" value="/applicant/applications" />
          <input aria-label="Reference number" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-500 focus:ring-2 focus:ring-[#CE1126] focus:outline-none md:w-52" name="reference" placeholder="Reference No..." type="text" />
          <button className={`rounded-xl bg-[#0B1A30] px-4 py-3 text-xs font-bold whitespace-nowrap text-white uppercase transition-colors hover:bg-slate-800 ${focusRing}`} type="submit">
            Track Status
          </button>
        </form>
      </div>

      {jobs.isLoading ? (
        <p className="text-xs text-slate-500" role="status">Loading job openings…</p>
      ) : jobs.error ? (
        <p className="text-xs text-[#CE1126]" role="alert">{jobs.error.message}</p>
      ) : !rows.length ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-xs text-slate-600" role="status">No published openings are available right now. Please check again soon for the next recruitment announcement.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {rows.map((job, index) => (
            <li key={job.id}>
              <article aria-labelledby={`job-${job.id}-title`} className="flex h-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-[#CE1126] hover:shadow-md">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${index % 2 ? "bg-[#0B1A30]/10 text-[#0B1A30]" : "bg-[#CE1126]/10 text-[#CE1126]"}`}>{job.location ?? "San Juan City"}</span>
                    <span className="flex items-center text-xs font-semibold text-slate-500">
                      <Clock aria-hidden="true" className="mr-1 size-3" /> CY {new Date(job.published_at ?? job.created_at).getFullYear()}
                    </span>
                  </div>
                  <h4 className="mb-2 text-lg font-extrabold text-slate-900 uppercase [overflow-wrap:anywhere]" id={`job-${job.id}-title`}>{job.title}</h4>
                  <p className="mb-4 line-clamp-3 text-xs leading-relaxed text-slate-600">{job.description}</p>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                  <span className="text-xs font-bold text-[#CE1126]">{job.closes_on ? `Deadline: ${formatDate(job.closes_on)}` : "Open until filled"}</span>
                  <Link aria-label={`Apply now for ${job.title}`} className={`flex items-center gap-1 rounded text-xs font-extrabold text-[#CE1126] hover:underline ${focusRing}`} href={`/jobs/${job.id}`}>
                    <span>Apply Now</span>
                    <ArrowRight aria-hidden="true" className="size-2.5" />
                  </Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <span>
          New applicant?{" "}
          <Link className={`rounded font-bold text-[#CE1126] hover:underline ${focusRing}`} href="/applicant/register">Create an applicant account</Link>
        </span>
        <Link className={`inline-flex items-center gap-1 rounded font-bold text-[#CE1126] hover:underline ${focusRing}`} href="/jobs">
          View all openings <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
      </p>
    </div>
  );
}

function LoginModal() {
  const roles = [
    { href: "/login?as=employee", icon: UserCog, iconClass: "bg-[#0B1A30] group-hover:bg-[#CE1126]", title: "HR / Employee Portal", caption: "For HR Admin and San Juan Personnel" },
    { href: "/login?as=applicant", icon: IdCard, iconClass: "bg-[#CE1126]", title: "Applicant Portal", caption: "For SJCPS Applicants" },
  ];
  return (
    <DialogPrimitive.Root>
      <DialogPrimitive.Trigger className={`flex shrink-0 items-center gap-2 rounded-xl border border-red-500/30 bg-[#CE1126] px-4 py-3 whitespace-nowrap sm:px-5 text-xs font-bold text-white uppercase shadow-lg transition-all hover:bg-red-700 hover:shadow-red-900/50 ${focusRing}`}>
        <Lock aria-hidden="true" className="size-3.5" />
        <span>Portal Login</span>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md" />
        <DialogPrimitive.Popup className="capstone-ui fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-slate-100 bg-white p-6 text-slate-800 shadow-2xl">
          <DialogPrimitive.Close aria-label="Close" className={`absolute top-4 right-4 rounded text-slate-500 hover:text-slate-700 ${focusRing}`}>
            <X aria-hidden="true" className="size-5" />
          </DialogPrimitive.Close>
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-[#CE1126] text-xl font-bold text-white shadow-lg">
              <ShieldHalf aria-hidden="true" className="size-6" />
            </div>
            <DialogPrimitive.Title className="text-xl font-black text-slate-900 uppercase">Select User Role</DialogPrimitive.Title>
            <DialogPrimitive.Description className="mt-1 text-xs text-slate-500">Please select your designated role to proceed to the login page.</DialogPrimitive.Description>
          </div>
          <div className="space-y-3">
            {roles.map(({ caption, href, icon: Icon, iconClass, title }) => (
              <Link className={`group flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition-all hover:border-[#CE1126] hover:bg-red-50/50 ${focusRing}`} href={href} key={href}>
                <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl text-white transition-colors ${iconClass}`}>
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <span className="block text-xs font-bold text-slate-900 uppercase">{title}</span>
                  <span className="block text-[11px] text-slate-500">{caption}</span>
                </span>
              </Link>
            ))}
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function PublicCareersLanding() {
  return (
    <div className="capstone-ui min-h-dvh scroll-smooth bg-slate-900 font-sans text-slate-100 antialiased selection:bg-[#CE1126] selection:text-white">
      <div className="bg-[#CE1126] px-4 py-2 text-xs text-white shadow-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between font-medium">
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="size-2 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
            <span>Republic of the Philippines • San Juan City Police Station</span>
          </div>
          <div className="hidden items-center gap-6 sm:flex">
            <span className="flex items-center"><Phone aria-hidden="true" className="mr-1 size-3" /> Emergency Hotline: <strong className="ml-1 text-amber-200">911</strong></span>
            <span className="flex items-center"><ShieldHalf aria-hidden="true" className="mr-1 size-3" /> PNP HRIS Official Gateway</span>
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B1A30]/85 backdrop-blur-md transition-all">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className={`flex min-w-0 items-center gap-3 rounded-xl ${focusRing}`} href="/">
            <Image alt="San Juan City Police Station logo" className="size-11 shrink-0 object-contain drop-shadow-lg" height={44} priority src="/san-juan-police-logo.png" width={44} />
            <span className="min-w-0">
              <span className="block text-sm leading-tight font-extrabold tracking-wide text-white uppercase sm:text-lg">San Juan City Police</span>
              <span className="block text-xs font-bold tracking-widest text-[#EF4444] uppercase max-sm:hidden">Human Resource Information System</span>
            </span>
          </Link>
          <nav aria-label="Page sections" className="hidden items-center gap-8 text-sm font-semibold text-slate-300 md:flex">
            <a className={`rounded transition-colors hover:text-[#EF4444] ${focusRing}`} href="#hero">Home</a>
            <a className={`rounded transition-colors hover:text-[#EF4444] ${focusRing}`} href="#hub">Portal Hub</a>
            <a className={`rounded transition-colors hover:text-[#EF4444] ${focusRing}`} href="#vicinity">Vicinity Map</a>
          </nav>
          <LoginModal />
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-gradient-to-b from-[#0B1A30] via-[#152C4F] to-slate-900 py-20 lg:py-24" id="hero">
          <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(#CE1126_1px,transparent_1px)] [background-size:24px_24px] opacity-10" />
          <div className="relative z-10 mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <span className="mb-6 inline-flex items-center rounded-full border border-[#CE1126]/30 bg-[#CE1126]/20 px-4 py-1.5 text-xs font-bold tracking-wider text-red-400 uppercase backdrop-blur-sm">
              <BadgeCheck aria-hidden="true" className="mr-2 size-3.5 text-[#F59E0B]" /> Official HR Management System
            </span>
            <h1 className="mb-6 text-4xl leading-tight font-black tracking-tight text-white uppercase sm:text-6xl" id="hero-heading">
              Serve San Juan with <span className="text-[#CE1126] drop-shadow-lg">Purpose &amp; Honor</span>
            </h1>
            <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed font-normal text-slate-300 sm:text-lg">
              Centralized digital portal for San Juan City Police Station personnel services, recruitment applications, and official advisories.
            </p>
          </div>
        </section>

        <section aria-label="Portal Hub" className="relative z-20 mx-auto -mt-10 max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 lg:px-8" id="hub">
          <TabsPrimitive.Root className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-800 shadow-2xl" defaultValue="about">
            <TabsPrimitive.List aria-label="Portal Hub" className="flex flex-wrap justify-center gap-2 border-b border-slate-200 bg-slate-100 p-3 sm:justify-start sm:p-4">
              {tabs.map(({ icon: Icon, label, value }) => (
                <TabsPrimitive.Tab
                  className={`flex items-center gap-2 rounded-2xl px-6 py-3.5 text-xs font-black tracking-wider text-slate-600 uppercase transition-all hover:bg-slate-200 data-active:bg-[#CE1126] data-active:text-white data-active:shadow-md data-active:hover:bg-[#CE1126] ${focusRing}`}
                  key={value}
                  value={value}
                >
                  <Icon aria-hidden="true" className="size-3.5" />
                  <span>{label}</span>
                </TabsPrimitive.Tab>
              ))}
            </TabsPrimitive.List>
            <div className="min-h-[500px] p-6 sm:p-12">
              <TabsPrimitive.Panel className="outline-none" value="about"><AboutTab /></TabsPrimitive.Panel>
              <TabsPrimitive.Panel className="outline-none" value="news"><NewsTab /></TabsPrimitive.Panel>
              <TabsPrimitive.Panel className="outline-none" value="faq"><FaqTab /></TabsPrimitive.Panel>
              <TabsPrimitive.Panel className="outline-none" value="recruitment"><RecruitmentTab /></TabsPrimitive.Panel>
            </div>
          </TabsPrimitive.Root>
        </section>

        <section aria-labelledby="vicinity-heading" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 sm:px-6 lg:px-8" id="vicinity">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold tracking-widest text-[#EF4444] uppercase">Station Location</span>
            <h2 className="mt-1 text-3xl font-black tracking-tight text-white uppercase" id="vicinity-heading">Vicinity Map &amp; Contact Details</h2>
            <p className="mt-2 text-xs text-slate-400">Find San Juan City Police Station headquarters and official location map.</p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-3">
            <div className="min-h-[400px] rounded-2xl border border-slate-700 bg-slate-800 p-2 shadow-2xl lg:col-span-2">
              {/* Google's embed replaces the mock's OpenStreetMap tiles, which OSM blocks for apps (403 "Access blocked"). */}
              <iframe
                className="block h-full min-h-[400px] w-full rounded-2xl border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(STATION_MAP_QUERY)}&z=16&output=embed`}
                title="Map of San Juan City Police Station"
              />
            </div>

            <div className="flex flex-col justify-between rounded-2xl border border-slate-700 bg-slate-800/90 p-6 shadow-xl">
              <div>
                <div className="mb-6 flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#CE1126] font-bold text-white">
                    <MapPin aria-hidden="true" className="size-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-white">San Juan City Police Station</h3>
                    <p className="text-xs text-slate-400">Eastern Police District (EPD)</p>
                  </div>
                </div>

                <div className="space-y-4 text-xs text-slate-300">
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3.5">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase">Station Address</span>
                    <p className="leading-normal font-bold text-white">Santolan Road cor. Col. Bonny Serrano Avenue, San Juan City, Metro Manila</p>
                  </div>
                  <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3.5">
                    <span className="mb-1 block text-[10px] font-semibold text-slate-400 uppercase">Hotline Numbers</span>
                    <p className="text-sm font-bold text-amber-400">0917-773-7885 / (02) 8724-2515</p>
                  </div>
                </div>
              </div>

              <div className="pt-6">
                <a
                  className={`block w-full rounded-xl bg-[#CE1126] py-3.5 text-center text-xs font-bold text-white uppercase shadow-lg transition-all hover:bg-red-700 ${focusRing}`}
                  href={`https://maps.google.com/?q=${encodeURIComponent(STATION_MAP_QUERY)}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Get Directions on Google Maps <ExternalLink aria-hidden="true" className="ml-1 inline size-3" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 px-4 py-8 text-xs text-slate-400">
        <div className="mx-auto max-w-7xl space-y-2 text-center">
          <p>San Juan City Police Station • Human Resource Information System</p>
          <p>Protected under the Data Privacy Act of 2012 (Republic Act No. 10173).</p>
        </div>
      </footer>
    </div>
  );
}
