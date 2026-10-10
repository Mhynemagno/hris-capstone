"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { ErrorState } from "@/components/ui/error-state";
import { LoadingState } from "@/components/ui/loading-state";
import { useCreateDeployment, useDeployment, useUpdateDeployment } from "@/hooks/use-deployment-tracking";

import { DeploymentForm } from "./deployment-form";

/** New-deployment and Update pages. Saving returns to the read-only details page. */
export function HrDeploymentEditor({ deploymentId }: { deploymentId?: string }) {
  const router = useRouter();
  const detail = useDeployment(deploymentId ?? "");
  const create = useCreateDeployment();
  const update = useUpdateDeployment();
  if (deploymentId && detail.isLoading) return <LoadingState label="Loading deployment…" />;
  if (deploymentId && (detail.error || !detail.data)) return <ErrorState message={detail.error?.message ?? "Deployment not found."} />;
  const deployment = detail.data;

  return (
    <section className="space-y-6">
      {deployment ? <Link className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline" href={`/hr/deployments/${deployment.id}`}>Back to deployment details</Link> : null}
      <DeploymentForm
        deployment={deployment ?? undefined}
        pending={create.isPending || update.isPending}
        onSaved={async (input) => {
          if (deployment) {
            await update.mutateAsync({ ...input, id: deployment.id, expectedUpdatedAt: deployment.updated_at });
            router.push(`/hr/deployments/${deployment.id}`);
          } else {
            const id = await create.mutateAsync(input);
            router.push(`/hr/deployments/${id}`);
          }
        }}
      />
    </section>
  );
}
