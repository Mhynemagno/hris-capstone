import Link from "next/link";
import { ApplicantRegistrationForm } from "@/components/auth/applicant-registration-form";
import { AuthCard } from "@/components/auth/auth-card";
import { getRecruitmentNextPath } from "@/lib/auth/recruitment-next-path";

export default async function ApplicantRegistrationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = getRecruitmentNextPath(next);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
  return <AuthCard title="Create an applicant account" description="Register to apply for future job openings."><ApplicantRegistrationForm loginHref={loginHref} nextPath={nextPath} /><p className="mt-5 text-center text-sm">Already have an account? <Link className="font-medium text-primary underline-offset-4 hover:underline" href={loginHref}>Login</Link></p></AuthCard>;
}
