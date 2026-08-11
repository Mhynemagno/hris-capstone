import type { ReactNode } from "react";

type AuthCardProps = {
  children: ReactNode;
  description: string;
  title: string;
};

export function AuthCard({ children, description, title }: AuthCardProps) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-950 px-6 py-12 text-slate-50">
      <section className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h1 className="text-2xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm text-slate-300">{description}</p>
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}
