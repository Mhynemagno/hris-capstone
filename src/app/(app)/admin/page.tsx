import Link from "next/link";
import { Building2, Fingerprint, ScrollText, Settings, ShieldCheck, type LucideIcon, UserCog, UserPen, Users } from "lucide-react";

import { PageTitle } from "@/components/staff-shell/ui/page-title";

type AdminLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

type AdminArea = {
  title: string;
  description: string;
  icon: LucideIcon;
  iconClassName: string;
  items: AdminLink[];
};

const adminAreas: AdminArea[] = [
  {
    title: "People and Access",
    description: "Control who can access the station HR system and review account changes.",
    icon: UserCog,
    iconClassName: "border-blue-200 bg-blue-50 text-blue-700",
    items: [
      { href: "/admin/users", label: "Manage Accounts", description: "Create, update, and secure user access.", icon: Users },
      { href: "/admin/profile-change-requests", label: "Review Approvals", description: "Validate personnel profile updates.", icon: UserPen },
    ],
  },
  {
    title: "Station Organization",
    description: "Keep units, stations, and ranks aligned with the current command structure.",
    icon: Building2,
    iconClassName: "border-amber-200 bg-amber-50 text-amber-700",
    items: [
      { href: "/admin/departments", label: "Units and Sections", description: "Maintain operational unit records.", icon: Building2 },
      { href: "/admin/unit-stations", label: "Units and Stations", description: "Manage station and deployment locations.", icon: ShieldCheck },
      { href: "/admin/ranks", label: "Ranks", description: "Maintain the personnel rank catalogue.", icon: ShieldCheck },
    ],
  },
  {
    title: "System Oversight",
    description: "Review the integrations, controls, and audit trail behind daily HR operations.",
    icon: ScrollText,
    iconClassName: "border-purple-200 bg-purple-50 text-purple-700",
    items: [
      { href: "/admin/integrations/attendance", label: "Attendance Integration", description: "Configure attendance data intake.", icon: Fingerprint },
      { href: "/admin/audit-logs", label: "Audit Log", description: "Review security and operational activity.", icon: ScrollText },
      { href: "/admin/settings", label: "System Settings", description: "Maintain system-wide settings.", icon: Settings },
    ],
  },
];

export default function AdminPage() {
  return (
    <section className="space-y-6">
      <PageTitle subtitle="Manage secure access, organizational records, and system controls for the station." title="System Administration" />
      <div className="grid gap-6 md:grid-cols-3">
        {adminAreas.map((area) => (
          <section aria-labelledby={area.title.toLowerCase().replaceAll(" ", "-")} className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm" key={area.title}>
            <div className="border-b border-slate-100 bg-slate-50/50 p-5">
              <span className={`mb-3 flex size-10 items-center justify-center rounded-xl border ${area.iconClassName}`}><area.icon aria-hidden="true" className="size-5" /></span>
              <h2 className="text-base font-bold text-slate-900" id={area.title.toLowerCase().replaceAll(" ", "-")}>{area.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{area.description}</p>
            </div>
            <div className="divide-y divide-slate-100">
              {area.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="group flex gap-3.5 p-4 text-left transition-colors hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600" href={item.href} key={item.href}>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-blue-50 group-hover:text-blue-700"><Icon aria-hidden="true" className="size-4" /></span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold text-slate-900 transition-colors group-hover:text-blue-700">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] text-slate-500">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-500">Administrative activity is recorded in the station audit trail.</p>
    </section>
  );
}
