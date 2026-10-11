import { PIPELINE_STAGES } from "@/lib/recruitment/application-stages";

const COLUMNS = [...PIPELINE_STAGES, "Not Selected"] as const;

/** Capstone UI dashboard.html "Recruitment Pipeline Overview": one column per stage, drawn without a chart library. */
export function PipelineColumns({ rows }: { rows: { label: string; count: number }[] }) {
  const counts = new Map(rows.map((row) => [row.label, row.count]));
  const total = COLUMNS.reduce((sum, stage) => sum + (counts.get(stage) ?? 0), 0);
  const max = Math.max(0, ...COLUMNS.map((stage) => counts.get(stage) ?? 0));
  return (
    <section aria-labelledby="pipeline-heading" className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900" id="pipeline-heading">Recruitment Pipeline Overview</h2>
          <p className="text-xs text-slate-500">Vertical column breakdown of candidates per recruitment stage</p>
        </div>
        <span className="shrink-0 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{total} Total Applicants</span>
      </div>

      <div aria-hidden="true" className="flex h-80 items-end gap-2 border-b border-slate-100 pt-2">
        {COLUMNS.map((stage) => {
          const count = counts.get(stage) ?? 0;
          const colour = stage === "Not Selected" ? "bg-rose-500" : count > 0 ? "bg-blue-600" : "bg-slate-300";
          return (
            <div className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" key={stage}>
              <span className="font-mono text-[10px] font-bold text-slate-700">{count}</span>
              <div className="flex h-[calc(100%-3.5rem)] w-full items-end justify-center">
                <div className={`w-6 rounded-t-md ${colour}`} style={{ height: `${max ? (count / max) * 100 : 0}%`, minHeight: "2px" }} />
              </div>
              <span className="line-clamp-2 h-7 text-center text-[9px] leading-tight font-semibold text-slate-600">{stage}</span>
            </div>
          );
        })}
      </div>
      <table className="sr-only">
        <caption>Applicants per recruitment stage</caption>
        <tbody>
          {COLUMNS.map((stage) => <tr key={stage}><th scope="row">{stage}</th><td>{counts.get(stage) ?? 0}</td></tr>)}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 text-[11px] font-medium text-slate-500">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-blue-600" /> Active Candidate</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-slate-300" /> Empty Stage</span>
          <span className="flex items-center gap-1.5"><span aria-hidden="true" className="size-3 rounded bg-rose-500" /> Disqualified / Not Selected</span>
        </div>
        <span className="font-bold text-slate-700">Updated Real-Time</span>
      </div>
    </section>
  );
}
