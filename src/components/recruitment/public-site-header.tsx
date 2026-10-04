"use client";

import Image from "next/image";
import Link from "next/link";

import { PublicAccountAction } from "@/components/public-site/public-account-action";

export function PublicSiteHeader() {
  return (
    <header className="border-b border-border bg-background/95 backdrop-blur">
      <nav aria-label="Public navigation" className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link className="inline-flex min-h-11 items-center gap-2.5 rounded-lg font-semibold tracking-tight focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50" href="/">
          <Image alt="" className="size-9 object-contain" height={36} src="/san-juan-police-logo.png" width={36} />
          <span>San Juan City Police</span>
        </Link>
        <PublicAccountAction />
      </nav>
    </header>
  );
}
