"use client";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import { CapstoneAccountMenu } from "@/components/app-shell/capstone-account-menu";

/** Capstone UI notifapp.html: the applicant's avatar, name and email, opening Profile and Logout. */
export function ApplicantAccountMenu({ email, name }: { email: string | null; name: string }) {
  return (
    <CapstoneAccountMenu
      afterLogoutHref="/"
      ariaLabel={`Account menu for ${name}`}
      email={email}
      name={name}
      onError={(title, description) => notifyApplicant({ title, description, tone: "error" })}
      profileHref="/applicant/profile"
      tone="dark"
    />
  );
}
