"use client";

import { Building2, BriefcaseBusiness, ContactRound, LayoutDashboard, PanelLeft, ScrollText, Settings, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
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
import type { RoleConfig } from "@/lib/app/role-config";

type AppShellProps = {
  children: ReactNode;
  config: RoleConfig;
  email: string | null;
};

function getInitials(email: string | null) {
  return email?.slice(0, 2).toUpperCase() ?? "HR";
}

const navigationIcons = { LayoutDashboard, Users, ShieldCheck, Building2, BriefcaseBusiness, Settings, ScrollText, ContactRound };

export function AppShell({ children, config, email }: AppShellProps) {
  const pathname = usePathname();

  return (
    <TooltipProvider>
      <SidebarProvider>
        <a
          href="#main-content"
          className="sr-only fixed top-4 left-4 z-50 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <Sidebar collapsible="offcanvas" variant="inset">
          <SidebarHeader className="p-4">
            <div className="flex items-center gap-3 rounded-xl bg-sidebar-accent px-3 py-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                <LayoutDashboard aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="truncate text-sm font-semibold">San Juan City Police</p>
                <p className="truncate text-xs text-muted-foreground">
                  Workforce hub
                </p>
              </div>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Main navigation</SidebarGroupLabel>
              <SidebarGroupContent>
                <nav aria-label="Main navigation">
                  <SidebarMenu>
                    {config.navigation.map((item) => {
                      const isActive = pathname === item.href;
                      const Icon = navigationIcons[item.icon];

                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
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
                </nav>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="space-y-3 rounded-xl border border-sidebar-border bg-sidebar-accent/60 p-3 group-data-[collapsible=icon]:hidden">
              <div className="flex items-center gap-3">
                <Avatar className="size-9">
                  <AvatarFallback>{getInitials(email)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{email ?? "Signed in"}</p>
                  <Badge className="mt-1" variant="secondary">
                    {config.label}
                  </Badge>
                </div>
              </div>
              <SignOutButton />
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset id="main-content">
          <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur sm:px-6">
            <SidebarTrigger aria-label="Toggle sidebar">
              <PanelLeft aria-hidden="true" />
            </SidebarTrigger>
            <Separator className="h-5" orientation="vertical" />
            <Breadcrumb aria-label="Breadcrumb">
              <BreadcrumbList>
                <BreadcrumbItem className="hidden sm:block">
                  <span className="text-muted-foreground">{config.label}</span>
                </BreadcrumbItem>
                <BreadcrumbItem>
                  <BreadcrumbPage>{config.landingTitle}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </header>
          <div className="flex flex-1 flex-col px-4 py-8 sm:px-6 lg:px-10">
            <div className="mx-auto w-full max-w-6xl">{children}</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
