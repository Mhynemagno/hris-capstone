import { HrDeploymentEditor } from "@/components/deployment-tracking/hr-deployment-editor";
import { PageHeader } from "@/components/ui/page-header";
export default function NewDeploymentPage() { return <section className="space-y-4"><PageHeader description="Assign an employee to a location, unit, or project." eyebrow="Personnel deployments" title="New deployment" /><HrDeploymentEditor /></section>; }
