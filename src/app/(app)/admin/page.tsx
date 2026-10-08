import Link from "next/link";
import { Building2, Fingerprint, ScrollText, Settings, ShieldCheck, type LucideIcon, UserPen, Users } from "lucide-react";

import { AdminPage as AdminWorkspacePage } from "@/components/administration/admin-page";

type AdminLink = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const adminAreas: { title: string; description: string; items: AdminLink[] }[] = [
  {
    title: "People and access",
    description: "Control who can access the station HR system and review account changes.",
    items: [
      { href: "/admin/users", label: "Manage accounts", description: "Create, update, and secure user access.", icon: Users },
      { href: "/admin/profile-change-requests", label: "Review approvals", description: "Validate personnel profile updates.", icon: UserPen },
    ],
  },
  {
    title: "Station organization",
    description: "Keep units, stations, and ranks aligned with the current command structure.",
    items: [
      { href: "/admin/departments", label: "Units and sections", description: "Maintain operational unit records.", icon: Building2 },
      { href: "/admin/unit-stations", label: "Units and stations", description: "Manage station and deployment locations.", icon: ShieldCheck },
      { href: "/admin/ranks", label: "Ranks", description: "Maintain the personnel rank catalogue.", icon: ShieldCheck },
    ],
  },
  {
    title: "System oversight",
    description: "Review the integrations, controls, and audit trail behind daily HR operations.",
    items: [
      { href: "/admin/integrations/attendance", label: "Attendance integration", description: "Configure attendance data intake.", icon: Fingerprint },
      { href: "/admin/audit-logs", label: "Audit log", description: "Review security and operational activity.", icon: ScrollText },
      { href: "/admin/settings", label: "System settings", description: "Maintain system-wide settings.", icon: Settings },
    ],
  },
];

export default function AdminPage() {
  return (
    <AdminWorkspacePage description="Manage secure access, organizational records, and system controls for the station." title="System administration">
      <div className="grid gap-5 xl:grid-cols-3">
        {adminAreas.map((area) => (
          <section aria-labelledby={area.title.toLowerCase().replaceAll(" ", "-")} className="rounded-lg border bg-card" key={area.title}>
            <div className="border-b px-5 py-4">
              <h2 className="text-lg font-semibold" id={area.title.toLowerCase().replaceAll(" ", "-")}>{area.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{area.description}</p>
            </div>
            <div className="divide-y">
              {area.items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="group flex gap-3 px-5 py-4 transition-colors hover:bg-muted focus-visible:outline-offset-[-3px]" href={item.href} key={item.href}>
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary"><Icon aria-hidden="true" className="size-[18px]" /></span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-foreground group-hover:text-primary">{item.label}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{item.description}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </AdminWorkspacePage>
  );
}
