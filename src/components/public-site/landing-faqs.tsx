import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

import { SectionIntro } from "./section-intro";

const linkClass = "font-semibold text-cta underline underline-offset-4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

const faqs: { question: string; answer: ReactNode }[] = [
  {
    question: "Who can apply?",
    answer: (
      <p>
        Anyone who meets the qualifications listed on a job opening can apply. Open a posting on the{" "}
        <Link className={linkClass} href="/jobs">job openings page</Link> to see its requirements, then create an applicant account to apply online.
      </p>
    ),
  },
  {
    question: "Which documents do I need?",
    answer: (
      <>
        <p>Every application needs these five documents, saved on your applicant Documents page:</p>
        <ul className="list-disc space-y-1 pl-5">
          {APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label, formats }) => (
            <li key={kind}>{`${label} (${formats})`}</li>
          ))}
        </ul>
      </>
    ),
  },
  {
    question: "How do I check my application status?",
    answer: (
      <p>
        Sign in with your applicant account and open Application Status to see where each application stands.{" "}
        <Link className={linkClass} href="/login?as=applicant&next=/applicant/applications">Sign in to see your status</Link>
      </p>
    ),
  },
];

export function LandingFaqs() {
  return (
    <section aria-labelledby="faqs-heading" className="scroll-mt-24 border-t border-border/80" id="faqs">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <SectionIntro align="center" eyebrow="Help" id="faqs-heading" title="Frequently asked questions" />
        <div className="mt-8 space-y-3">
          {faqs.map(({ answer, question }) => (
            <details className="group glass-panel rounded-xl border border-border" key={question}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-xl px-5 py-3 text-base font-semibold text-white hover:text-cta focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown aria-hidden="true" className="size-5 shrink-0 text-slate-300 group-open:rotate-180 motion-safe:transition-transform" />
              </summary>
              <div className="space-y-3 border-t border-border px-5 py-4 text-base leading-7 text-slate-300">{answer}</div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
