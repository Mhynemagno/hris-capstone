import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPanel } from "@/components/ui/status-panel";

export function AdminPage({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <section className="space-y-8"><PageHeader description={description} eyebrow="Administration" title={title} />{children}</section>;
}

export function AdminEmptyState({ title, description }: { title: string; description: string }) {
  return <StatusPanel description={description} kind="empty" title={title} />;
}
