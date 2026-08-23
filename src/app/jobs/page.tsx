import { PublicJobList } from "@/components/recruitment/public-job-list";

export default function JobsPage() {
  return <main className="mx-auto max-w-6xl px-6 py-12"><p className="text-sm font-medium text-primary">Careers</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Current job openings</h1><p className="mt-2 text-muted-foreground">Find an opportunity that fits your experience and submit an application securely.</p><div className="mt-8"><PublicJobList /></div></main>;
}
