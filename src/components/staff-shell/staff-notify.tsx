"use client";

import { ApplicantToaster, notifyApplicant } from "@/components/app-shell/applicant-toaster";

/** Staff screens use the same dark Capstone UI notices as the applicant portal. */
export const notifyStaff = notifyApplicant;
export const StaffToaster = ApplicantToaster;
export const notifyStaffError = (title: string, description: string) => notifyApplicant({ title, description, tone: "error" });
