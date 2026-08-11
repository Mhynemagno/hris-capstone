import type { ReactNode } from "react";
import { Building2, ShieldCheck } from "lucide-react";

type AuthCardProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:p-10">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden bg-slate-900 p-10 text-slate-50 lg:flex lg:flex-col lg:justify-between">
          <div><div className="flex size-11 items-center justify-center rounded-xl bg-blue-500 text-white"><Building2 aria-hidden="true" className="size-6" /></div><p className="mt-8 text-sm font-semibold tracking-[0.18em] text-blue-200">HRIS CAPSTONE</p><h2 className="mt-3 text-4xl font-semibold tracking-tight">A clearer home for your workforce.</h2><p className="mt-5 max-w-sm text-base leading-7 text-slate-300">Secure access for employees, HR personnel, administrators, applicants, and management.</p></div>
          <p className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck aria-hidden="true" className="size-4 text-emerald-300" /> Your session is protected by Supabase Auth.</p>
        </aside>
        <div className="p-6 sm:p-10"><div className="mx-auto w-full max-w-md"><div className="flex items-center gap-3 lg:hidden"><div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Building2 aria-hidden="true" className="size-5" /></div><p className="text-sm font-semibold">HRIS Capstone</p></div><h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-950 lg:mt-0">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{description}</p><div className="mt-8">{children}</div></div></div>
      </section>
    </main>
  );
}
