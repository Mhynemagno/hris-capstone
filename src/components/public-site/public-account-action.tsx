"use client";

import { BriefcaseBusiness, ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const loginChoices = [
  { href: "/login?as=employee", icon: UserRound, label: "Login as Employee" },
  { href: "/login?as=applicant", icon: BriefcaseBusiness, label: "Login as Applicant" },
] as const;

/** The Login menu for visitors, or a shortcut to Application Status once signed in. */
export function PublicAccountAction() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) return;
    const client = createBrowserSupabaseClient();
    void client.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (isSignedIn) {
    return (
      <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/applicant/applications">
        Application Status
      </Link>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
        Login
        <ChevronDown aria-hidden="true" className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-1.5">
        {loginChoices.map(({ href, icon: Icon, label }) => (
          <DropdownMenuItem className="min-h-11 gap-2.5 px-3 text-sm font-medium" key={href} render={<Link href={href} />}>
            <Icon aria-hidden="true" className="size-4 text-primary" />
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
