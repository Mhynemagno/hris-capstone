import type { ReactNode } from "react";

export function AdminPage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <section className="space-y-6"><div className="space-y-2"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="max-w-2xl text-muted-foreground">{description}</p></div>{children}</section>;
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-xl border bg-card p-6 text-card-foreground"><h2 className="font-semibold">{title}</h2><p className="mt-2 text-sm text-muted-foreground">{description}</p></div>;
}
