import { Clock, Globe, Mail, MapPin, Phone, type LucideIcon } from "lucide-react";

import { contactHref } from "@/lib/public-site/contacts";
import type { PublicContactKind, VisibleContact } from "@/lib/types/database";

import { SectionIntro } from "./section-intro";

const kindIcons: Record<PublicContactKind, LucideIcon> = { phone: Phone, email: Mail, address: MapPin, hours: Clock, facebook: Globe };

/** HR-managed contact entries. Renders nothing until HR has made at least one visible. */
export function LandingContacts({ contacts }: { contacts: readonly VisibleContact[] }) {
  if (!contacts.length) return null;
  return (
    <section aria-labelledby="contact-heading" className="scroll-mt-24 border-t border-border/80" id="contact">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <SectionIntro eyebrow="Get in touch" id="contact-heading" title="Contact us" />
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => {
            const Icon = kindIcons[contact.kind];
            const href = contactHref(contact.kind, contact.value);
            const external = contact.kind === "facebook";
            return (
              <li className="glass-panel flex gap-4 rounded-2xl border border-border p-5" key={contact.id}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-cta/10 text-cta">
                  <Icon aria-hidden="true" className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-semibold text-white">{contact.label}</p>
                  {href ? (
                    <a
                      className="inline-flex min-h-11 items-center text-base text-cta underline-offset-4 [overflow-wrap:anywhere] hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      href={href}
                      {...(external ? { rel: "noopener noreferrer", target: "_blank" } : {})}
                    >
                      {contact.value}
                      {external ? <span className="sr-only"> (opens in a new tab)</span> : null}
                    </a>
                  ) : (
                    <p className="text-base whitespace-pre-line text-slate-300 [overflow-wrap:anywhere]">{contact.value}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
