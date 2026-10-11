"use client";

import { ChevronDown, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { clearSessionOnlyCookie } from "@/lib/supabase/remember-me";
import { cn } from "@/lib/utils";

export function accountInitials(name: string) {
  const words = name.split(/\s+/).filter(Boolean);
  const named = words.length > 1 && /^[A-Z]{2,}$/.test(words[0]!) ? words.slice(1) : words;
  const picked = named.length > 1 ? [named[0]!, named.at(-1)!] : named;
  return picked.map((word) => word[0]!.toUpperCase()).join("") || "U";
}

type Props = {
  name: string;
  email: string | null;
  ariaLabel: string;
  /** "dark" sits on the applicant's navy bar, "light" on the staff shell's white bar. */
  tone: "dark" | "light";
  profileHref?: string;
  afterLogoutHref: string;
  onError: (title: string, description: string) => void;
};

/** Capstone UI account menu: avatar, name and email, opening (Profile and) Logout. */
export function CapstoneAccountMenu({ name, email, ariaLabel, tone, profileHref, afterLogoutHref, onError }: Props) {
  const router = useRouter();
  async function logout() {
    // Local scope: signing out here must not end the same account's sessions on other devices.
    const { error } = await createBrowserSupabaseClient().auth.signOut({ scope: "local" });
    if (error) { onError("Could not log out", error.message); return; }
    clearSessionOnlyCookie();
    router.replace(afterLogoutHref);
    router.refresh();
  }
  const dark = tone === "dark";
  return (
    <div className={cn("relative border-l pl-3", dark ? "border-slate-800" : "border-slate-200")}>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={ariaLabel} className={cn("group flex items-center gap-2.5 rounded-lg focus:outline-none focus-visible:ring-2", dark ? "focus-visible:ring-blue-400" : "focus-visible:ring-blue-700")}>
          <span className={cn("flex items-center justify-center rounded-full font-bold shadow-sm", dark ? "size-8 border border-blue-400 bg-blue-600 text-xs text-white" : "size-9 border border-slate-700 bg-slate-900 text-xs text-amber-400")}>
            {accountInitials(name)}
          </span>
          <span className="hidden text-left sm:block">
            <span className={cn("block text-xs leading-tight", dark ? "font-semibold text-slate-200 group-hover:text-white" : "font-bold text-slate-900")}>{name}</span>
            {email ? <span className={cn("block text-[10px] leading-tight", dark ? "text-slate-400" : "text-slate-500")}>{email}</span> : null}
          </span>
          <ChevronDown aria-hidden="true" className={cn("ml-1 size-3", dark ? "text-slate-400" : "text-slate-500")} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="capstone-ui w-52 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-xl ring-0">
          <div className="border-b border-slate-100 px-4 py-2 sm:hidden">
            <p className="font-bold text-slate-900">{name}</p>
            {email ? <p className="truncate text-[10px] text-slate-500">{email}</p> : null}
          </div>
          {profileHref ? (
            <>
              <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:bg-slate-50" render={<Link href={profileHref} />}>
                <User aria-hidden="true" className="size-4 text-slate-500" /> Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator className="mx-0 my-1 bg-slate-100" />
            </>
          ) : null}
          <DropdownMenuItem className="flex w-full items-center gap-2.5 rounded-none px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 focus:bg-red-50 focus:text-red-600" onClick={() => void logout()}>
            <LogOut aria-hidden="true" className="size-4" /> Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
