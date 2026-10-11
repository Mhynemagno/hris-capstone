import Link from "next/link";

import { ApplicantAuthFrame } from "@/components/auth/applicant-auth-frame";
import { ApplicantRegistrationForm } from "@/components/auth/applicant-registration-form";
import { getRecruitmentNextPath } from "@/lib/auth/recruitment-next-path";
import { getRecruitmentNotice } from "@/lib/recruitment/recruitment-notice";

export default async function ApplicantRegistrationPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nextPath = getRecruitmentNextPath(next);
  const loginHref = nextPath ? `/login?as=applicant&next=${encodeURIComponent(nextPath)}` : "/login?as=applicant";
  const notice = await getRecruitmentNotice();
  return (
    <ApplicantAuthFrame notice={notice}>
      <div className="mb-6">
        <span className="mb-3 inline-block rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-bold tracking-wider text-blue-900 uppercase">
          Applicant Portal
        </span>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Create Applicant Account</h1>
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">Register to apply for the current recruitment.</p>
      </div>
      <ApplicantRegistrationForm loginHref={loginHref} nextPath={nextPath} />
      <p className="mt-6 text-center text-xs text-slate-500">
        Already have an account? <Link className="font-bold text-blue-800 hover:text-blue-900 hover:underline" href={loginHref}>Login</Link>
      </p>
    </ApplicantAuthFrame>
  );
}
