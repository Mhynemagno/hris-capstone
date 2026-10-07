"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { PanelLeft } from "lucide-react";

import { AccountMenu } from "@/components/auth/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Toaster } from "@/components/ui/toaster";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RoleConfig, RoleNavigationItem } from "@/lib/app/role-config";

import { BreadcrumbProvider, WorkspaceBreadcrumbs } from "./breadcrumbs";
import { NavBadge } from "./nav-badge";
import { NAVIGATION_ICONS } from "./nav-icons";

type WorkspaceShellProps = { children: ReactNode; config: RoleConfig; email: string | null };

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

/** Laptop widths start with the icon rail; a choice the user made earlier is restored at any width. */
function CollapseOnLaptop() {
  const { setOpen } = useSidebar();
  useEffect(() => {
    // shadcn writes the choice to a cookie but never reads it back, so restore it here.
    const remembered = /(?:^|; )sidebar_state=(true|false)/.exec(document.cookie)?.[1];
    if (remembered) {
      if (remembered === "false") setOpen(false);
      return;
    }
    if (window.matchMedia("(min-width: 768px) and (max-width: 1279px)").matches) setOpen(false);
  }, [setOpen]);
  return null;
}

/** After client navigation, move focus to the new page's heading for screen-reader users. */
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

export function WorkspaceShell({ children, config, email }: WorkspaceShellProps) {
  const pathname = usePathname();
  const active = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const section = active ?? (pathname === "/notifications" ? { href: "/notifications" as const, label: "Notifications" } : { href: config.homeHref, label: config.landingTitle });

  // Overlays render in portals under <body>; scoping <html> gives them the workspace tokens too.
  useEffect(() => {
    document.documentElement.classList.add("workspace");
    return () => document.documentElement.classList.remove("workspace");
  }, []);
  useFocusHeadingOnRouteChange(pathname);

  return (
    <TooltipProvider>
      <BreadcrumbProvider>
        <SidebarProvider className="workspace h-svh overflow-hidden" style={{ "--sidebar-width": "15.5rem", "--sidebar-width-icon": "4rem" } as CSSProperties}>
          <CollapseOnLaptop />
          <a className="sr-only fixed top-4 left-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only" href="#main-content">
            Skip to main content
          </a>
          <Sidebar className="app-sidebar border-sidebar-border" collapsible="icon">
            <SidebarHeader className="px-3 pt-4 pb-3">
              <Link className="flex items-center gap-3 rounded-md p-1 group-data-[collapsible=icon]:justify-center" href={config.homeHref}>
                <Image alt="San Juan City Police Station logo" className="size-8 shrink-0 object-contain" height={32} priority src="/san-juan-police-logo.png" width={32} />
                <span className="min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="block truncate text-base font-semibold text-foreground">San Juan CPS</span>
                  <span className="block text-sm text-muted-foreground">HRIS</span>
                </span>
              </Link>
            </SidebarHeader>
            <SidebarContent className="pb-4">
              <nav aria-label="Main navigation">
                {groupNavigation(config.navigation).map((group, index) => (
                  <SidebarGroup className="px-3 py-1.5" key={group.label ?? `ungrouped-${index}`}>
                    {group.label ? (
                      <SidebarGroupLabel className="h-7 px-2 text-xs font-medium tracking-normal text-muted-foreground normal-case">{group.label}</SidebarGroupLabel>
                    ) : null}
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-0.5">
                        {group.items.map((item) => {
                          const isActive = active?.href === item.href;
                          const Icon = NAVIGATION_ICONS[item.icon];
                          return (
                            <SidebarMenuItem className="relative" key={item.href}>
                              <SidebarMenuButton
                                className="h-9 gap-3 rounded-md px-3 text-base font-medium text-sidebar-foreground hover:bg-muted hover:text-foreground data-active:bg-primary-subtle data-active:font-semibold data-active:text-primary data-active:shadow-[inset_2px_0_0_var(--primary)] [&_svg]:size-[18px]"
                                isActive={isActive}
                                render={<Link aria-current={isActive ? "page" : undefined} href={item.href} />}
                                tooltip={item.label}
                              >
                                <Icon aria-hidden="true" />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                              {item.badge ? <NavBadge badge={item.badge} /> : null}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                ))}
              </nav>
            </SidebarContent>
          </Sidebar>
          <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-background" id="main-content">
            <header className="dark sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 bg-topbar px-3 text-foreground sm:px-4">
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-command-red" data-testid="brand-command-accent" />
              <SidebarTrigger aria-label="Toggle sidebar" className="size-9 text-white/80 hover:bg-white/10 hover:text-white">
                <PanelLeft aria-hidden="true" />
              </SidebarTrigger>
              <WorkspaceBreadcrumbs section={section} />
              <div className="ml-auto flex items-center gap-1">
                <NotificationBell />
                <AccountMenu email={email} roleLabel={config.label} />
              </div>
            </header>
            <div className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 2xl:px-8">
              <div className="mx-auto w-full max-w-6xl min-w-0 has-[[data-page-width=narrow]]:max-w-[60rem] has-[[data-page-width=wide]]:max-w-[90rem]">{children}</div>
            </div>
          </SidebarInset>
          <Toaster />
        </SidebarProvider>
      </BreadcrumbProvider>
    </TooltipProvider>
  );
}
