import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
export default function ForgotPasswordPage() { return <AuthCard title="Reset password" description="We will send you a secure reset link."><ForgotPasswordForm /><Link className="mt-5 block text-sm" href="/login">Back to sign in</Link></AuthCard>; }
