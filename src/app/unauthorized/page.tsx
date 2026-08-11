import { ShieldAlert } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-md text-center shadow-sm">
        <CardHeader className="items-center space-y-4">
          <div className="rounded-full bg-destructive/10 p-3 text-destructive">
            <ShieldAlert aria-hidden="true" className="size-7" />
          </div>
          <div className="space-y-2">
            <h1 className="font-heading text-2xl font-medium">Access denied</h1>
            <CardDescription>
              Your account does not have permission to view that workspace.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button render={<Link href="/login" />}>
            Return to sign in
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
