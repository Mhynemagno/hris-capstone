import { EmployeeDeploymentList } from "@/components/deployment-tracking/employee-deployment-list";
export default function EmployeeDeploymentsPage() { return <section className="space-y-4"><div><h1 className="text-3xl font-semibold">My deployments</h1><p className="mt-2 text-muted-foreground">Review your current and previous assignments.</p></div><EmployeeDeploymentList /></section>; }
