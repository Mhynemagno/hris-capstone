import { HrDeploymentEditor } from "@/components/deployment-tracking/hr-deployment-editor";
import { PageHeader } from "@/components/ui/page-header";
export default async function DeploymentDetailPage({ params }: { params: Promise<{ deploymentId: string }> }) { const { deploymentId } = await params; return <section className="space-y-4"><PageHeader description="Update this assignment. Every change is kept in its history." eyebrow="Personnel deployments" title="Deployment details" /><HrDeploymentEditor deploymentId={deploymentId} /></section>; }
