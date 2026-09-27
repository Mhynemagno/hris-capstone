import { HrDeploymentDirectory } from "@/components/deployment-tracking/hr-deployment-directory";
import { PageHeader } from "@/components/ui/page-header";
export default function HrDeploymentsPage() { return <section className="space-y-4"><PageHeader description="Create and maintain personnel assignments without losing their history." title="Deployments" /><HrDeploymentDirectory /></section>; }
