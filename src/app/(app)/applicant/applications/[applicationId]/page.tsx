import { redirect } from "next/navigation";

/** Each applicant has one status page now; old links to a single application open it. */
export default async function ApplicantApplicationDetailPage() {
  redirect("/applicant/applications");
}
