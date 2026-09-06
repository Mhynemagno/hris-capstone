"use client";

import { BriefcaseBusiness } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function PublicSiteHeader() {
  const [isSignedIn, setIsSignedIn] = useState(false);
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void client.auth.getUser().then(({ data }) => setIsSignedIn(Boolean(data.user)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setIsSignedIn(Boolean(session?.user)));
    return () => listener.subscription.unsubscribe();
  }, []);
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <nav
        aria-label="Public navigation"
        className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
      >
        <Link
          className="inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight"
          href="/"
        >
          <BriefcaseBusiness aria-hidden="true" className="size-5 text-primary" />
          <span>San Juan City Police</span>
        </Link>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            href="/jobs"
          >
            Careers
          </Link>
          <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href={isSignedIn ? "/applicant/applications" : "/login"}>{isSignedIn ? "My applications" : "Sign in"}</Link>
        </div>
      </nav>
    </header>
  );
}
