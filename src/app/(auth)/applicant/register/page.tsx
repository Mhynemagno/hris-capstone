import Link from "next/link";
import { ApplicantRegistrationForm } from "@/components/auth/applicant-registration-form";
import { AuthCard } from "@/components/auth/auth-card";
export default function ApplicantRegistrationPage() { return <AuthCard title="Create an applicant account" description="Register to apply for future job openings."><ApplicantRegistrationForm /><Link className="mt-5 block text-sm" href="/login">Already have an account? Sign in</Link></AuthCard>; }
