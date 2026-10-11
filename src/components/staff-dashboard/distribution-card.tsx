"use client";

import { ChevronDown, Funnel, Mars, Venus } from "lucide-react";
import { useState } from "react";

import { rankCategory, rankRowLabel } from "@/lib/personnel/rank-category";
import { distributionRows } from "@/lib/staff/distribution";
import type { HrDashboardOverview } from "@/schemas/reporting";

type View = "units" | "ranks" | "gender";

const UNIT_COLOURS = ["bg-slate-900", "bg-slate-800", "bg-blue-800", "bg-blue-800", "bg-slate-700", "bg-slate-700", "bg-slate-700"];
const PCO_COLOURS = ["bg-slate-900", "bg-slate-800", "bg-slate-700"];
const PNCO_COLOURS = ["bg-blue-900", "bg-blue-800", "bg-blue-700", "bg-blue-600", "bg-blue-500"];

/** Bar colours by rank tier, in the mockup's order: slate for commissioned, blue for non-commissioned, amber for civilians. */
function rankColours(codes: (string | null)[]) {
  let commissioned = 0;
  let nonCommissioned = 0;
  return codes.map((code) => {
    const category = rankCategory(code);
    if (category.startsWith("Commissioned")) return PCO_COLOURS[Math.min(commissioned++, PCO_COLOURS.length - 1)]!;
    if (category.startsWith("Non-Commissioned")) return PNCO_COLOURS[Math.min(nonCommissioned++, PNCO_COLOURS.length - 1)]!;
    return "bg-amber-600";
  });
}

function Bar({ colour, width }: { colour: string; width: number }) {
  return (
    <div aria-hidden="true" className="h-3 w-full overflow-hidden rounded-full border border-slate-200 bg-slate-100 p-0.5">
      <div className={`${colour} h-full rounded-full transition-all duration-300`} style={{ width: `${width}%` }} />
    </div>
  );
}

function RowHeader({ label, detail, value }: { label: string; detail?: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs font-bold">
      <div>
        <span className="text-slate-900">{label}</span>
        {detail ? <span className="ml-1.5 text-[10px] font-semibold text-slate-500">({detail})</span> : null}
      </div>
      <span className="shrink-0 font-mono text-slate-900">{value}</span>
    </div>
  );
}

/** Capstone UI dashboard.html "Personnel Distribution" card with its Units / Ranks / Gender filter. */
export function DistributionCard({ units, overview }: { units: { label: string; count: number }[]; overview: HrDashboardOverview | undefined }) {
  const [view, setView] = useState<View>("units");
  const ranks = overview?.personnelByRank ?? [];
  const genders = (overview?.personnelByGender ?? []).filter((item) => item.label !== "unspecified" || item.count > 0);
  const genderTotal = genders.reduce((sum, item) => sum + item.count, 0);
  const rankRows = distributionRows(ranks.map((rank) => ({ label: rank.code ?? "", count: rank.count })));
  const colours = rankColours(ranks.map((rank) => rank.code));

  const header = view === "units"
    ? { title: "Personnel Distribution by Unit", description: `Headcount breakdown across ${units.length} station units`, footer: `Showing ${units.length} Station Units`, total: units.reduce((sum, item) => sum + item.count, 0) }
    : view === "ranks"
      ? { title: "Personnel Distribution by Rank Hierarchy", description: "Rank structure sorted from Highest Rank to Lowest Rank", footer: `Showing ${ranks.length} Rank Classifications`, total: ranks.reduce((sum, item) => sum + item.count, 0) }
      : { title: "Personnel Distribution by Gender", description: "Demographic breakdown of Male and Female station personnel", footer: "Showing Gender Distribution", total: genderTotal };

  return (
    <section aria-labelledby="distribution-heading" className="space-y-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-base font-bold text-slate-900" id="distribution-heading">{header.title}</h2>
          <p className="text-xs text-slate-500">{header.description}</p>
        </div>
        <div className="relative">
          <select
            aria-label="Filter personnel distribution"
            className="cursor-pointer appearance-none rounded-xl border border-slate-200 bg-slate-50 py-2 pr-8 pl-9 text-xs font-bold text-slate-800 shadow-sm focus:ring-2 focus:ring-blue-600 focus:outline-none"
            onChange={(event) => setView(event.target.value as View)}
            value={view}
          >
            <option value="units">Filter by Units</option>
            <option value="ranks">Filter by Ranks (Highest to Lowest)</option>
            <option value="gender">Filter by Gender</option>
          </select>
          <Funnel aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-3 -translate-y-1/2 text-slate-500" />
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-2.5 -translate-y-1/2 text-slate-500" />
        </div>
      </div>

      <div className="space-y-3.5">
        {view === "units" ? distributionRows(units).map((row, index) => (
          <div className="space-y-1" key={row.label}>
            <RowHeader label={row.label} value={`${row.count} Personnel (${row.percent})`} />
            <Bar colour={UNIT_COLOURS[index] ?? "bg-teal-600"} width={row.width} />
          </div>
        )) : null}

        {view === "ranks" ? rankRows.map((row, index) => (
          <div className="space-y-1" key={`${row.label}-${index}`}>
            <RowHeader detail={rankCategory(ranks[index]!.code)} label={rankRowLabel(ranks[index]!.code, ranks[index]!.name)} value={`${row.count} Personnel (${row.percent})`} />
            <Bar colour={colours[index]!} width={row.width} />
          </div>
        )) : null}

        {view === "gender" ? genders.map((item) => {
          const percent = genderTotal ? (item.count / genderTotal) * 100 : 0;
          const style = item.label === "male"
            ? { title: "Male Personnel", icon: <Mars aria-hidden="true" className="size-4 text-blue-600" />, colour: "bg-blue-700" }
            : item.label === "female"
              ? { title: "Female Personnel", icon: <Venus aria-hidden="true" className="size-4 text-pink-500" />, colour: "bg-pink-600" }
              : { title: "Not specified", icon: null, colour: "bg-slate-500" };
          return (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4" key={item.label}>
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="flex items-center gap-2 text-slate-900">{style.icon}<span>{style.title}</span></span>
                <span className="font-mono text-sm font-black text-slate-900">{item.count} ({percent.toFixed(1)}%)</span>
              </div>
              <div aria-hidden="true" className="h-3.5 w-full overflow-hidden rounded-full border border-slate-300 bg-slate-200 p-0.5">
                <div className={`${style.colour} h-full rounded-full transition-all duration-500`} style={{ width: `${percent}%` }} />
              </div>
            </div>
          );
        }) : null}
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] font-medium text-slate-500">
        <span>{header.footer}</span>
        <span className="font-bold text-slate-700">Total: {header.total} Personnel</span>
      </div>
    </section>
  );
}
