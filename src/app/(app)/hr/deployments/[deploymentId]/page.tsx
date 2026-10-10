import { HrDeploymentDetails } from "@/components/deployment-tracking/hr-deployment-details";
import { PageHeader } from "@/components/ui/page-header";

export default async function DeploymentDetailPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  return <section className="space-y-4"><PageHeader description="Assignment details and every change made to it." title="Deployment details" /><HrDeploymentDetails deploymentId={deploymentId} /></section>;
}
