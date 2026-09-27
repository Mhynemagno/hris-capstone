import { ApplicantProfileForm } from "@/components/recruitment/applicant-profile-form";
import { PageHeader } from "@/components/ui/page-header";

export default function ApplicantProfilePage() {
  return <div className="space-y-6"><PageHeader title="Profile" /><ApplicantProfileForm /></div>;
}
