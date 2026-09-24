import { HrDeploymentDirectory } from "@/components/deployment-tracking/hr-deployment-directory";
import { PageHeader } from "@/components/ui/page-header";
export default function HrDeploymentsPage() { return <section className="space-y-4"><PageHeader description="Create and maintain personnel assignments without losing their history." eyebrow="Personnel deployments" title="Deployments" /><HrDeploymentDirectory /></section>; }
