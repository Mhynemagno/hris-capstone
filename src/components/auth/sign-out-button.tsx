"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await createBrowserSupabaseClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button
      className="w-full justify-center"
      disabled={pending}
      onClick={signOut}
      type="button"
      variant="outline"
    >
      {pending ? "Signing out..." : "Sign out"}
    </Button>
  );
}
