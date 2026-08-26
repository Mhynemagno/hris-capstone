"use client";

import { LogOut } from "lucide-react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AccountMenuProps = {
  email: string | null;
  roleLabel: string;
};

function getInitials(email: string | null) {
  return email?.slice(0, 2).toUpperCase() ?? "HR";
}

export function AccountMenu({ email, roleLabel }: AccountMenuProps) {
  const identity = email ?? "signed-in user";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${identity}`}
        className="inline-flex min-h-11 min-w-11 items-center gap-2 rounded-lg border border-border bg-background px-2.5 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Avatar className="size-7">
          <AvatarFallback>{getInitials(email)}</AvatarFallback>
        </Avatar>
        <span className="hidden max-w-44 truncate sm:inline">
          {email ?? "Account"}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 p-2">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2 text-sm text-foreground">
            <span className="block truncate font-medium">{email ?? "Signed in"}</span>
            <span className="mt-1 block font-normal text-muted-foreground">
              {roleLabel}
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <SignOutButton
          className="w-full justify-start"
          icon={<LogOut aria-hidden="true" className="size-4" />}
          variant="ghost"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
