"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type SignOutButtonProps = {
  className?: string;
  icon?: ReactNode;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
};

export function SignOutButton({
  className,
  icon,
  variant = "outline",
}: SignOutButtonProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    setError(null);
    try {
      const result = await createBrowserSupabaseClient().auth.signOut();
      if (result.error) throw result.error;
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "We could not sign you out. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        className={cn(
          "w-full justify-center",
          !className && "border-sidebar-border bg-sidebar text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          className,
        )}
        disabled={pending}
        onClick={signOut}
        type="button"
        variant={variant}
      >
        {icon ?? <LogOut aria-hidden="true" />}
        {pending ? "Signing out..." : "Sign out"}
      </Button>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
    </div>
  );
}
