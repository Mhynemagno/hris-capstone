import { redirect } from "next/navigation";

/** Editing a deployment happens in the Deployments side panel (Capstone UI dep.html). */
export default async function UpdateDeploymentPage({ params }: { params: Promise<{ deploymentId: string }> }) {
  const { deploymentId } = await params;
  redirect(`/hr/deployments?edit=${encodeURIComponent(deploymentId)}`);
}
