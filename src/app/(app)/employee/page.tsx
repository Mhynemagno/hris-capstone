import { RoleLanding } from "@/components/app-shell/role-landing";
import { ROLE_CONFIG } from "@/lib/app/role-config";

export default function EmployeePage() {
  return <RoleLanding config={ROLE_CONFIG.employee} />;
}
