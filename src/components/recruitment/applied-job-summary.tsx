import { Badge } from "@/components/ui/badge";
import { rankLabel } from "@/lib/ranks";
import type { Application, AppliedJob } from "@/lib/types/database";

type AppliedJobSummaryProps = {
  job: AppliedJob | null;
  status: Application["status"];
  submittedAt: string;
};

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}

/** What the applicant applied for: the job, where it sits, and what it asks for. */
export function AppliedJobSummary({ job, status, submittedAt }: AppliedJobSummaryProps) {
  const criteria = [...(job?.job_qualification_criteria ?? [])].sort((left, right) => left.ordinal - right.ordinal);

  return (
    <section aria-labelledby="applied-job-heading" className="space-y-4 rounded-xl border p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold" id="applied-job-heading">What you applied for</h2>
        <Badge variant="secondary">{status}</Badge>
      </div>
      {job ? (
        <>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <Detail label="Job" value={job.title} />
            <Detail label="Department" value={job.departments?.name ?? "Not assigned"} />
            <Detail label="Rank" value={job.ranks ? rankLabel(job.ranks) : "Not assigned"} />
            <Detail label="Location" value={job.location ?? "Not specified"} />
            <Detail label="Applications close" value={job.closes_on ?? "No closing date"} />
            <Detail label="Submitted" value={new Date(submittedAt).toLocaleString()} />
          </dl>
          <div>
            <h3 className="text-sm font-semibold">About the job</h3>
            <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">{job.description}</p>
          </div>
          {criteria.length ? (
            <div>
              <h3 className="text-sm font-semibold" id="applied-job-criteria">Qualifications</h3>
              <ul aria-labelledby="applied-job-criteria" className="mt-2 list-disc space-y-1 pl-5 text-sm">
                {criteria.map((criterion) => (
                  <li key={criterion.id}>{criterion.requirement}{criterion.is_required ? " (required)" : ""}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">The job details are no longer available.</p>
          <p>Submitted {new Date(submittedAt).toLocaleString()}</p>
        </div>
      )}
    </section>
  );
}
