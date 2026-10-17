"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import { CapstoneAccountMenu } from "@/components/app-shell/capstone-account-menu";
import { NotificationDrawer } from "@/components/app-shell/notification-drawer";
import { Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAVIGATION_ICONS } from "@/components/workspace-shell/nav-icons";
import type { RoleConfig, RoleNavigationItem } from "@/lib/app/role-config";
import { cn } from "@/lib/utils";

import { isRedesignedStaffRoute, staffPageSubtitle } from "./page-meta";
import { StaffNavBadge } from "./staff-nav-badge";
import { notifyStaffError, StaffToaster } from "./staff-notify";

type StaffShellProps = { children: ReactNode; config: RoleConfig; email: string | null; displayName: string };

function groupNavigation(items: readonly RoleNavigationItem[]) {
  const groups: { label: string | null; items: RoleNavigationItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? null;
    const current = groups.at(-1);
    if (current && current.label === label) current.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

function useFocusHeadingOnRouteChange(pathname: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const frame = requestAnimationFrame(() => {
      const heading = document.querySelector<HTMLElement>("#main-content h1");
      if (!heading) return;
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
}

function StaffNavigation({ activeHref, config }: { activeHref: string | undefined; config: RoleConfig }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Main navigation" className="space-y-6 px-3 py-4">
      {groupNavigation(config.navigation).map((group) => (
        <div key={group.label ?? "top"}>
          {group.label ? <p className="mb-1.5 px-3 text-[10px] font-extrabold tracking-wider text-slate-400 uppercase">{group.label}</p> : null}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = activeHref === item.href;
              const Icon = NAVIGATION_ICONS[item.icon];
              return (
                <div className="relative" key={item.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 text-xs transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                      active ? "rounded-xl bg-blue-700 px-3.5 py-2.5 font-bold text-white shadow-lg shadow-blue-900/40" : "rounded-lg px-3.5 py-2 font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white",
                    )}
                    href={item.href}
                    onClick={() => { if (isMobile) setOpenMobile(false); }}
                  >
                    <Icon aria-hidden="true" className={cn("w-4 shrink-0", active && "size-4")} />
                    <span>{item.label}</span>
                  </Link>
                  {item.badge ? <StaffNavBadge badge={item.badge} /> : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** HR frame from the Capstone UI dashboard.html: navy sidebar, white top bar, slate canvas. */
export function StaffShell({ children, config, email, displayName }: StaffShellProps) {
  const pathname = usePathname();
  const active = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const redesigned = isRedesignedStaffRoute(pathname);
  const roleLabel = config.role === "hr_personnel" ? "HR" : config.role === "employee" ? "Employee" : config.role === "applicant" ? "Applicant" : config.label;
  const accountName = displayName.trim().split(/\s+/).at(-1) ?? displayName;

  // Unredesigned pages' dialogs render in portals under <body>; scoping <html> gives them the workspace tokens.
  useEffect(() => {
    document.documentElement.classList.add("workspace");
    return () => document.documentElement.classList.remove("workspace");
  }, []);
  useFocusHeadingOnRouteChange(pathname);

  return (
    <TooltipProvider>
      <SidebarProvider className="capstone-ui h-svh overflow-hidden font-sans text-slate-800 antialiased" style={{ "--sidebar-width": "16rem" } as CSSProperties}>
        <a className="sr-only fixed top-4 left-4 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-blue-700" href="#main-content">
          Skip to main content
        </a>
        <Sidebar className="border-r border-slate-800 [&_[data-sidebar=sidebar]]:bg-[#0B132B] [&_[data-sidebar=sidebar]]:text-slate-300" collapsible="offcanvas">
          <SidebarHeader className="border-b border-slate-800/80 p-4">
            <Link className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400" href={config.homeHref}>
              <Image alt="San Juan City Police Station logo" className="size-10 shrink-0 object-contain" height={40} priority src="/san-juan-police-logo.png" width={40} />
              <span className="truncate text-xs font-extrabold tracking-wider text-white uppercase">San Juan City Police Station</span>
            </Link>
          </SidebarHeader>
          <SidebarContent>
            <StaffNavigation activeHref={active?.href} config={config} />
          </SidebarContent>
        </Sidebar>
        <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-slate-50" id="main-content">
          <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger aria-label="Toggle sidebar" className="size-9 rounded-lg text-slate-500 hover:bg-slate-100 md:hidden" />
              <Image alt="" className="hidden size-8 shrink-0 object-contain sm:block" height={32} src="/san-juan-police-logo.png" width={32} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-xs font-extrabold tracking-tight text-slate-900">SAN JUAN CITY POLICE STATION</span>
                </div>
                <p className="truncate text-[10px] font-medium text-slate-500">Eastern Police District</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDrawer onError={notifyStaffError} tone="light" />
              <CapstoneAccountMenu afterLogoutHref="/" ariaLabel={`Account menu for ${email ?? displayName}`} email={roleLabel} name={accountName} onError={notifyStaffError} profileHref={config.role === "employee" ? "/employee/profile" : undefined} tone="light" />
            </div>
          </header>
          <div className={cn("flex-1", redesigned ? "space-y-6 p-4 sm:p-6" : "workspace bg-background p-4 text-foreground sm:p-6 lg:p-8")}>
            <div className="mx-auto w-full max-w-7xl min-w-0">{children}</div>
          </div>
        </SidebarInset>
        <StaffToaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}
