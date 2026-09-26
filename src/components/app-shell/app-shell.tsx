"use client";

import { Building2, BriefcaseBusiness, CalendarDays, ChartColumn, Clock, ContactRound, FileText, Fingerprint, LayoutDashboard, MapPin, PanelLeft, Plus, ScrollText, Settings, ShieldCheck, TrendingUp, UserPen, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AccountMenu } from "@/components/auth/account-menu";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
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
  SidebarFooter,
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
import type { RoleConfig, RoleNavigationIcon, RoleNavigationItem } from "@/lib/app/role-config";

type AppShellProps = {
  children: ReactNode;
  config: RoleConfig;
  email: string | null;
};

function getInitials(email: string | null) {
  return email?.slice(0, 2).toUpperCase() ?? "HR";
}

const navigationIcons: Record<RoleNavigationIcon, typeof LayoutDashboard> = {
  LayoutDashboard,
  Users,
  ShieldCheck,
  Building2,
  BriefcaseBusiness,
  Settings,
  ScrollText,
  ContactRound,
  FileText,
  CalendarDays,
  MapPin,
  TrendingUp,
  Clock,
  Fingerprint,
  ChartColumn,
  UserPen,
};

/** Keeps configured order while grouping adjacent items under one heading. */
function groupNavigation(items: readonly RoleNavigationItem[]) {
  const groups: { label: string; items: RoleNavigationItem[] }[] = [];
  for (const item of items) {
    const label = item.group ?? "Main navigation";
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
      {/* Classic HRIS frame: a full-width navy top bar over a navy sidebar and a light work area. */}
      <SidebarProvider className="h-svh flex-col overflow-hidden">
        <a
          href="#main-content"
          className="sr-only fixed top-4 left-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <header className="dark relative z-20 flex h-16 shrink-0 items-center gap-3 border-b border-white/10 bg-topbar px-3 text-foreground sm:px-4">
          <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-command-red" data-testid="brand-command-accent" />
          <SidebarTrigger aria-label="Toggle sidebar" className="min-h-11 min-w-11 text-white/80 hover:bg-white/10 hover:text-white">
            <PanelLeft aria-hidden="true" />
          </SidebarTrigger>
          <Link className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={config.homeHref}>
            <Image
              alt="San Juan City Police Station logo"
              className="size-10 shrink-0 object-contain"
              height={40}
              priority
              src="/san-juan-police-logo.png"
              width={40}
            />
            <span className="min-w-0 leading-tight">
              <span className="block truncate font-heading text-lg font-bold tracking-wide text-white">SJCPS <span className="text-sidebar-ring">HRIS</span></span>
              <span className="hidden truncate text-xs text-white/60 sm:block">San Juan City Police Station</span>
            </span>
          </Link>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <AccountMenu email={email} roleLabel={config.label} />
          </div>
        </header>
        <div className="flex min-h-0 flex-1">
          <Sidebar className="top-16 h-[calc(100svh-4rem)] border-r-0" collapsible="offcanvas">
            <SidebarHeader className="p-3">
              <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 group-data-[collapsible=icon]:hidden">
                <div className="flex items-center gap-3">
                  <Avatar className="size-11 ring-2 ring-sidebar-primary/60">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground font-semibold">{getInitials(email)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-sidebar-accent-foreground" title={email ?? undefined}>{email ?? "Signed in"}</p>
                    <p className="flex items-center gap-1.5 text-xs text-sidebar-foreground/75">
                      {config.label}
                      <span aria-hidden="true" className="size-2 rounded-full bg-emerald-400" />
                      <span className="sr-only">(online)</span>
                    </p>
                  </div>
                </div>
                {config.quickAction ? (
                  <Link
                    className="mt-3 flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                    href={config.quickAction.href}
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    {config.quickAction.label}
                  </Link>
                ) : null}
              </div>
            </SidebarHeader>
            <SidebarContent>
              <nav aria-label="Main navigation">
                {groupNavigation(config.navigation).map((group) => (
                  <SidebarGroup className="pl-0" key={group.label}>
                    <SidebarGroupLabel className="pl-5 text-xs font-semibold tracking-wider text-sidebar-foreground/75 uppercase">{group.label}</SidebarGroupLabel>
                    <SidebarGroupContent>
                      <SidebarMenu>
                        {group.items.map((item) => {
                          const isActive = activeNavigationItem?.href === item.href;
                          const Icon = navigationIcons[item.icon];

                          return (
                            <SidebarMenuItem key={item.href}>
                              <SidebarMenuButton
                                className="rounded-l-none rounded-r-full pl-5 text-sidebar-foreground/85 data-active:bg-sidebar-primary data-active:text-sidebar-primary-foreground data-active:shadow-md data-active:shadow-black/20"
                                isActive={isActive}
                                tooltip={item.label}
                                render={
                                  <Link
                                    href={item.href}
                                    aria-current={isActive ? "page" : undefined}
                                  />
                                }
                              >
                                <Icon aria-hidden="true" />
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
            <SidebarFooter className="border-t border-sidebar-border p-3 group-data-[collapsible=icon]:hidden">
              <SignOutButton className="w-full justify-center border-sidebar-border bg-transparent text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" />
            </SidebarFooter>
          </Sidebar>
          <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-background" id="main-content">
            <div className="border-b bg-card/80 px-4 py-3 sm:px-6 lg:px-10">
              <Breadcrumb aria-label="Breadcrumb">
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden sm:block">
                    <span className="text-muted-foreground">{config.label}</span>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{currentPageLabel}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </div>
            <div className="flex min-w-0 flex-1 flex-col px-4 py-8 sm:px-6 lg:px-10">
              <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
}
