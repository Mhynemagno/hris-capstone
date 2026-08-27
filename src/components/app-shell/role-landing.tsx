import Link from "next/link";

import { PageHeader } from "@/components/ui/page-header";
import type { RoleConfig } from "@/lib/app/role-config";

type RoleLandingProps = {
  config: RoleConfig;
};

export function RoleLanding({ config }: RoleLandingProps) {
  const workflows = config.navigation.filter((item) => item.href !== config.homeHref);

  return (
    <section className="space-y-8" aria-labelledby="page-title">
      <PageHeader
        description={config.landingDescription}
        eyebrow={config.label}
        id="page-title"
        title={config.landingTitle}
      />
      <section aria-labelledby="available-workflows" className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold" id="available-workflows">What you can do here</h2>
          <p className="mt-1 text-sm text-muted-foreground">Choose a workflow to continue.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workflows.map((item) => (
            <Link className="flex min-h-14 items-center rounded-xl border bg-card px-4 py-3 font-medium shadow-sm transition-colors hover:border-primary/50 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </div>
      </section>
    </section>
  );
}
