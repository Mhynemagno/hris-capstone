import { HrPublicSiteWorkspace } from "@/components/public-site/hr-public-site-workspace";
import { PageHeader } from "@/components/ui/page-header";

export default function HrPublicSitePage() {
  return (
    <div className="space-y-8">
      <PageHeader description="Publish announcements and keep the station's contact details current on the public landing page." title="Announcements" />
      <HrPublicSiteWorkspace />
    </div>
  );
}
