import { ApplicantProfileDocuments } from "@/components/recruitment/applicant-profile-documents";
import { PageHeader } from "@/components/ui/page-header";

export default function ApplicantDocumentsPage() {
  return <div className="max-w-3xl space-y-6"><PageHeader description="Upload the documents required for your application." title="Documents" /><ApplicantProfileDocuments /></div>;
}
