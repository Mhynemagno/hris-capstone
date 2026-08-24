import { PageHeader } from "@/components/ui/page-header";
import { StatusPanel } from "@/components/ui/status-panel";
import type { RoleConfig } from "@/lib/app/role-config";

type RoleLandingProps = {
  config: RoleConfig;
};

export function RoleLanding({ config }: RoleLandingProps) {
  return (
    <section className="space-y-8" aria-labelledby="page-title">
      <PageHeader
        description={config.landingDescription}
        eyebrow={config.label}
        id="page-title"
        title={config.landingTitle}
      />
      <StatusPanel
        description="This workspace is ready for the next approved module. Your role-specific tools and summaries will appear here as they are delivered."
        kind="empty"
        title="What you can do here"
      />
    </section>
  );
}
