import { RoleLanding } from "@/components/app-shell/role-landing";
import { ROLE_CONFIG } from "@/lib/app/role-config";

export default function ApplicantPage() {
  return <RoleLanding config={ROLE_CONFIG.applicant} />;
}
