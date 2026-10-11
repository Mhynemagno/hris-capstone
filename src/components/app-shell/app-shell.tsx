"use client";

import { ChevronRight, ListChecks } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties, ReactNode } from "react";

import { ApplicantAccountMenu } from "@/components/app-shell/applicant-account-menu";
import { ApplicantToaster } from "@/components/app-shell/applicant-toaster";
import { NotificationDrawer } from "@/components/app-shell/notification-drawer";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NAVIGATION_ICONS } from "@/components/workspace-shell/nav-icons";
import { useApplicantProfile } from "@/hooks/use-recruitment";
import type { RoleConfig } from "@/lib/app/role-config";
import { cn } from "@/lib/utils";

type AppShellProps = {
  children: ReactNode;
  config: RoleConfig;
  email: string | null;
};

function SidebarNavigation({ activeHref, config }: { activeHref: string | undefined; config: RoleConfig }) {
  const { isMobile, setOpenMobile } = useSidebar();
  return (
    <nav aria-label="Main navigation" className="space-y-1">
      {config.navigation.map((item) => {
        const isActive = activeHref === item.href;
        const Icon = NAVIGATION_ICONS[item.icon];
        return (
          <Link
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800",
              isActive ? "bg-slate-900 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
            href={item.href}
            key={item.href}
            onClick={() => { if (isMobile) setOpenMobile(false); }}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** The applicant portal frame (Capstone UI notifapp.html): white sidebar, navy top bar, slate work area. */
export function AppShell({ children, config, email }: AppShellProps) {
  const pathname = usePathname();
  const profile = useApplicantProfile();
  const activeNavigationItem = config.navigation
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .toSorted((left, right) => right.href.length - left.href.length)[0];
  const currentPageLabel = activeNavigationItem?.label ?? (pathname === "/notifications" ? "Notifications" : config.landingTitle);
  const fullName = profile.data ? `${profile.data.first_name} ${profile.data.last_name}`.trim() : (email ?? "Applicant");

  return (
    <TooltipProvider>
      <SidebarProvider className="capstone-ui h-svh overflow-hidden font-sans text-slate-800 antialiased" style={{ "--sidebar-width": "16rem" } as CSSProperties}>
        <a
          href="#main-content"
          className="sr-only fixed top-4 left-4 z-50 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-blue-800 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <Sidebar className="border-r border-slate-200 [&_[data-sidebar=sidebar]]:bg-white" collapsible="offcanvas">
          <SidebarHeader className="flex flex-col items-center gap-0 border-b border-slate-100 p-5 text-center">
            <Link className="mb-2 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800" href={config.homeHref}>
              <Image
                alt="San Juan City Police Station logo"
                className="size-16 object-contain drop-shadow-md"
                height={64}
                priority
                src="/san-juan-police-logo.png"
                width={64}
              />
            </Link>
            <h2 className="text-xs leading-snug font-bold tracking-tight text-slate-900 uppercase">San Juan City Police Station</h2>
            <span className="text-[10px] font-medium text-slate-500">Recruitment Division</span>
          </SidebarHeader>
          <SidebarContent className="px-3 py-4">
            <div className="mb-2 px-3 text-[10px] font-bold tracking-wider text-slate-500 uppercase">Menu</div>
            <SidebarNavigation activeHref={activeNavigationItem?.href} config={config} />
          </SidebarContent>
          <SidebarFooter className="border-t border-slate-100 bg-slate-50 p-4 text-center">
            <p className="text-[10px] font-bold text-slate-500">PNP San Juan Recruitment Portal</p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="min-w-0 overflow-y-auto overscroll-contain bg-slate-50" id="main-content">
          <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-800 bg-[#0F172A] px-4 text-white sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger aria-label="Toggle sidebar" className="size-9 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white md:hidden" />
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-xs font-medium text-slate-300">
                <ListChecks aria-hidden="true" className="size-3.5 shrink-0 text-slate-400" />
                <span>{config.label}</span>
                <ChevronRight aria-hidden="true" className="size-3 shrink-0 text-slate-500" />
                <span aria-current="page" className="truncate font-bold text-white">{currentPageLabel}</span>
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NotificationDrawer />
              <ApplicantAccountMenu email={email} name={fullName} />
            </div>
          </header>
          <div className="flex-1 p-4 sm:p-6 lg:p-8">
            <div className="mx-auto w-full max-w-6xl min-w-0">{children}</div>
          </div>
        </SidebarInset>
        <ApplicantToaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}
