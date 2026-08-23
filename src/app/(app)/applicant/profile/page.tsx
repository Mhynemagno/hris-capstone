import { ApplicantProfileForm } from "@/components/recruitment/applicant-profile-form";

export default function ApplicantProfilePage() {
  return <main className="space-y-6"><div><p className="text-sm font-medium text-primary">Applicant portal</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Your profile</h1><p className="mt-2 text-muted-foreground">Keep your contact information current before submitting an application.</p></div><ApplicantProfileForm /></main>;
}
