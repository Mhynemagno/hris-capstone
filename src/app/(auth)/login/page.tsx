import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const { error, next } = await searchParams;
  const errorMessage = error === "invalid_credentials"
    ? "We could not sign you in. Check your details and try again."
    : undefined;

  return <AuthCard title="Sign in" description="Access your HRIS account securely."><LoginForm error={errorMessage} nextPath={getSafeNextPath(next)} /><div className="mt-5 flex justify-between text-sm"><Link href="/forgot-password">Forgot password?</Link><Link href="/applicant/register">Create applicant account</Link></div></AuthCard>;
}
