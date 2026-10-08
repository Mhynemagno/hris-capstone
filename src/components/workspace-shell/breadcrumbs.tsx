"use client";

import Link from "next/link";
import { createContext, Fragment, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";

export type Crumb = { label: string; href?: string };

const TrailContext = createContext<{ trail: Crumb[]; setTrail: (trail: Crumb[]) => void } | null>(null);

export function BreadcrumbProvider({ children }: { children: ReactNode }) {
  const [trail, setTrail] = useState<Crumb[]>([]);
  const value = useMemo(() => ({ trail, setTrail }), [trail]);
  return <TrailContext.Provider value={value}>{children}</TrailContext.Provider>;
}

/** A detail page names itself in the breadcrumb, e.g. Applications › Juan Dela Cruz. */
export function useBreadcrumbTrail(trail: Crumb[]) {
  const context = useContext(TrailContext);
  const key = JSON.stringify(trail);
  const setTrail = context?.setTrail;
  useEffect(() => {
    if (!setTrail) return;
    setTrail(JSON.parse(key) as Crumb[]);
    return () => setTrail([]);
  }, [key, setTrail]);
}

export function WorkspaceBreadcrumbs({ section, variant = "dark" }: { section: { label: string; href: string }; variant?: "dark" | "light" }) {
  const trail = useContext(TrailContext)?.trail ?? [];
  const crumbs: Crumb[] = [{ label: section.label, href: trail.length ? section.href : undefined }, ...trail];
  const isLight = variant === "light";
  return (
    <Breadcrumb aria-label="Breadcrumb" className="min-w-0" data-variant={variant}>
      <BreadcrumbList className={isLight ? "flex-nowrap text-muted-foreground" : "flex-nowrap text-white/75"}>
        {crumbs.map((crumb, index) => {
          const last = index === crumbs.length - 1;
          return (
            <Fragment key={`${crumb.label}-${index}`}>
              {index > 0 ? <BreadcrumbSeparator className={isLight ? "text-muted-foreground/60" : "text-white/45"} /> : null}
              <BreadcrumbItem className="min-w-0">
                {last || !crumb.href
                  ? <BreadcrumbPage className={isLight ? "truncate font-semibold text-foreground" : "truncate font-semibold text-white"}>{crumb.label}</BreadcrumbPage>
                  : <Link className={isLight ? "truncate rounded transition-colors hover:text-foreground" : "truncate rounded transition-colors hover:text-white"} href={crumb.href}>{crumb.label}</Link>}
              </BreadcrumbItem>
            </Fragment>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
