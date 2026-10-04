"use client";

import Link from "next/link";

import { BrandLogos } from "./brand-logos";
import { PstClock } from "./pst-clock";
import { PublicAccountAction } from "./public-account-action";

export const PORTAL_SECTIONS = [
  { id: "portals", label: "Portals" },
  { id: "announcements", label: "Announcements" },
  { id: "about", label: "About" },
  { id: "why-join", label: "Why Join" },
  { id: "faqs", label: "FAQs" },
  { id: "contact", label: "Contact" },
] as const;

export function PortalHeader({ showContact }: { showContact: boolean }) {
  const sections = PORTAL_SECTIONS.filter((section) => showContact || section.id !== "contact");
  return (
    <>
      <div className="bg-sidebar text-sm text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1 px-4 py-2 text-center sm:flex-row sm:px-6 sm:text-left lg:px-8">
          <p>Republic of the Philippines • Philippine National Police</p>
          <PstClock />
        </div>
      </div>
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6 lg:flex-nowrap lg:px-8">
          <Link className="inline-flex min-h-11 min-w-0 items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/">
            <BrandLogos priority size={48} />
            <span className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
              San Juan City Police Station <span className="text-primary">HRIS</span>
            </span>
          </Link>
          <nav aria-label="Page sections" className="order-last -mx-4 w-full overflow-x-auto px-4 lg:order-none lg:mx-0 lg:w-auto lg:px-0">
            <ul className="flex gap-1">
              {sections.map(({ id, label }) => (
                <li key={id}>
                  <a className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={`#${id}`}>
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <PublicAccountAction />
        </div>
      </header>
    </>
  );
}
