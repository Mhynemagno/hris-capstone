import { redirect } from "next/navigation";

/** Creating a deployment happens in the Deployments side panel (Capstone UI dep.html). */
export default function NewDeploymentPage() {
  redirect("/hr/deployments?create=1");
}
