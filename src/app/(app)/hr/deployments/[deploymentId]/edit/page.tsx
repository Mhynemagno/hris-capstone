import { HrDeploymentEditor } from "@/components/deployment-tracking/hr-deployment-editor";
import { PageHeader } from "@/components/ui/page-header";

export default async function UpdateDeploymentPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  return <section className="space-y-4"><PageHeader description="Change this assignment. Every change is kept in its history." title="Update deployment" /><HrDeploymentEditor deploymentId={deploymentId} /></section>;
}
