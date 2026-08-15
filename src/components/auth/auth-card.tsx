import type { ReactNode } from "react";
import { Building2, ShieldCheck } from "lucide-react";

type AuthCardProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-muted px-4 py-8 text-foreground sm:px-6 lg:p-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-xl shadow-sidebar/15 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-sidebar p-10 text-sidebar-foreground lg:flex lg:flex-col lg:justify-between">
          <div><div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Building2 aria-hidden="true" className="size-6" /></div><p className="mt-8 text-sm font-semibold tracking-[0.18em] text-blue-200">SAN JUAN CITY POLICE</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">A clearer home for your workforce.</h2><p className="mt-5 max-w-sm text-base leading-7 text-sidebar-foreground/75">Secure access for employees, HR personnel, administrators, applicants, and management.</p></div>
          <p className="flex items-center gap-2 text-sm text-sidebar-foreground/75"><ShieldCheck aria-hidden="true" className="size-4 text-blue-200" /> Your session is protected by Supabase Auth.</p>
        </aside>
        <div className="p-6 sm:p-10"><div className="mx-auto w-full max-w-md"><div className="flex items-center gap-3 lg:hidden"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building2 aria-hidden="true" className="size-5" /></div><p className="text-sm font-semibold">San Juan City Police</p></div><h1 className="mt-8 text-3xl font-semibold tracking-tight lg:mt-0">{title}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-8">{children}</div></div></div>
      </section>
    </main>
  );
}
