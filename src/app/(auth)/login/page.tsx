import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { getSafeNextPath } from "@/lib/auth/safe-redirect";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthCard title="Sign in" description="Access your HRIS account securely."><LoginForm nextPath={getSafeNextPath(next)} /><div className="mt-5 flex justify-between text-sm"><Link href="/forgot-password">Forgot password?</Link><Link href="/applicant/register">Create applicant account</Link></div></AuthCard>;
}
