import { Info } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoleConfig } from "@/lib/app/role-config";

type RoleLandingProps = {
  config: RoleConfig;
};

export function RoleLanding({ config }: RoleLandingProps) {
  return (
    <section className="space-y-8" aria-labelledby="page-title">
      <div className="max-w-2xl space-y-3">
        <p className="text-sm font-semibold tracking-wide text-primary uppercase">
          {config.label}
        </p>
        <h1 id="page-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {config.landingTitle}
        </h1>
        <p className="text-base leading-7 text-muted-foreground sm:text-lg">
          {config.landingDescription}
        </p>
      </div>
      <Card className="max-w-2xl border-primary/15 shadow-sm">
        <CardHeader className="flex-col items-start gap-4 space-y-0 sm:flex-row">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Info aria-hidden="true" className="size-5" />
          </div>
          <div className="space-y-1">
            <CardTitle>What you can do here</CardTitle>
            <CardDescription>
              Your role-specific tools and summaries will appear here as the
              corresponding HRIS modules are delivered.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This workspace is ready for the next approved module.
        </CardContent>
      </Card>
    </section>
  );
}
