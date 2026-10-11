"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { notifyApplicant } from "@/components/app-shell/applicant-toaster";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clearSessionOnlyCookie } from "@/lib/supabase/remember-me";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]!.toUpperCase()).join("") || "AP";
}

/** Capstone UI notifapp.html: the applicant's avatar, name and email, opening Profile and Logout. */
export function ApplicantAccountMenu({ email, name }: { email: string | null; name: string }) {
  const router = useRouter();

  async function logout() {
    // Local scope: signing out here must not end the same account's sessions on other devices.
    const { error } = await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    if (error) {
      notifyApplicant({ title: "Could not log out", description: error.message, tone: "error" });
      return;
    }
    clearSessionOnlyCookie();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="relative border-l border-slate-800 pl-3">
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Account menu for ${name}`}
          className="group flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <span className="flex size-8 items-center justify-center rounded-full border border-blue-400 bg-blue-600 text-xs font-bold text-white shadow-sm">
            {initials(name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-xs leading-tight font-semibold text-slate-200 transition-colors group-hover:text-white">{name}</span>
            {email ? <span className="block text-[10px] leading-tight text-slate-400">{email}</span> : null}
          </span>
          <ChevronDown aria-hidden="true" className="ml-1 size-3 text-slate-400" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="capstone-ui w-52 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-xl ring-0">
          <div className="border-b border-slate-100 px-4 py-2 sm:hidden">
            <p className="font-bold text-slate-900">{name}</p>
            {email ? <p className="truncate text-[10px] text-slate-500">{email}</p> : null}
          </div>
          <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50" render={<Link href="/applicant/profile" />}>
            <User aria-hidden="true" className="size-4 text-slate-400" /> Profile
          </DropdownMenuItem>
          <DropdownMenuSeparator className="mx-0 my-1 bg-slate-100" />
          <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-600" onClick={() => void logout()}>
            <LogOut aria-hidden="true" className="size-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
