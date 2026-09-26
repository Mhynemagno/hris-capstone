"use client";

import { PanelLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/auth/account-menu";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { RoleConfig, RoleNavigationItem } from "@/lib/app/role-config";

type AppShellProps = {
  children: ReactNode;
  config: RoleConfig;
  email: string | null;
};

/** Keeps configured order while grouping adjacent items under one heading. */
function groupNavigation(items: readonly RoleNavigationItem[]) {
  const groups: { label: string; items: RoleNavigationItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? "Menu";
    const current = groups.at(-1);
    if (current?.label === label) current.items.push(item);
    else groups.push({ label, items: [item] });
  }
  return groups;
}

export function AppShell({ children, config, email }: AppShellProps) {
  const pathname = usePathname();
  const activeNavigationItem = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const currentPageLabel = activeNavigationItem?.label ?? (pathname === "/notifications" ? "Notifications" : config.landingTitle);

  return (
    <TooltipProvider>
      {/* Classic HRIS frame: a full-height navy sidebar beside a navy top bar and a light work area. */}
      <SidebarProvider className="h-svh overflow-hidden">
        <a
          href="#main-content"
          className="sr-only fixed top-4 left-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <Sidebar className="border-r-0" collapsible="offcanvas">
          <SidebarHeader className="items-center gap-3 px-4 pt-6 pb-4 text-center">
            <Link className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring" href={config.homeHref}>
              <Image
                alt="San Juan City Police Station logo"
                className="size-24 object-contain drop-shadow-md"
                height={96}
                priority
                src="/san-juan-police-logo.png"
                width={96}
              />
            </Link>
            <p className="text-base text-sidebar-foreground italic">San Juan City Police Station</p>
          </SidebarHeader>
          <SidebarContent className="pb-6">
            <nav aria-label="Main navigation">
              {groupNavigation(config.navigation).map((group) => (
                <SidebarGroup className="px-3 py-2" key={group.label}>
                  <SidebarGroupLabel className="h-auto px-2 pb-1 text-sm font-bold tracking-wide text-sidebar-foreground/60 uppercase">{group.label}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-0.5">
                      {group.items.map((item) => {
                        const isActive = activeNavigationItem?.href === item.href;

                        return (
                          <SidebarMenuItem key={item.href}>
                            <SidebarMenuButton
                              className="min-h-10 px-4 text-base font-semibold text-white hover:bg-white/10 hover:text-white data-active:bg-white/12 data-active:text-white data-active:shadow-[inset_4px_0_0_var(--sidebar-ring)]"
                              isActive={isActive}
                              render={
                                <Link
                                  href={item.href}
                                  aria-current={isActive ? "page" : undefined}
                                />
                              }
                            >
                              <span>{item.label}</span>
                            </SidebarMenuButton>
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
          <header className="dark sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-topbar px-3 text-foreground sm:px-4">
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-command-red" data-testid="brand-command-accent" />
            <SidebarTrigger aria-label="Toggle sidebar" className="min-h-11 min-w-11 text-white/80 hover:bg-white/10 hover:text-white">
              <PanelLeft aria-hidden="true" />
            </SidebarTrigger>
            <Breadcrumb aria-label="Breadcrumb" className="min-w-0">
              <BreadcrumbList className="text-white/70">
                <BreadcrumbItem className="hidden sm:block">
                  <span>{config.label}</span>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden sm:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage className="font-semibold text-white">{currentPageLabel}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell />
              <AccountMenu email={email} roleLabel={config.label} />
            </div>
          </header>
          <div className="flex min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
