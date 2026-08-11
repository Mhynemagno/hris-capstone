"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() { const router = useRouter(); const [pending, setPending] = useState(false); async function signOut() { setPending(true); await createBrowserSupabaseClient().auth.signOut(); router.replace("/login"); router.refresh(); } return <button className="rounded-md border border-slate-600 px-5 py-3 font-medium text-white disabled:opacity-60" disabled={pending} onClick={signOut} type="button">{pending ? "Signing out…" : "Sign out"}</button>; }
