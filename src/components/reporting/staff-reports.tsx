"use client";

import { Award, ChartLine, FileSpreadsheet, History, MapPinned, Printer, UserCheck, UserPlus, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { notifyStaff } from "@/components/staff-shell/staff-notify";
import { PageTitle } from "@/components/staff-shell/ui/page-title";
import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { buildMasterlistCsv } from "@/lib/reporting/masterlist";
import { cn } from "@/lib/utils";
import { listStationMasterlist } from "@/queries/reporting";
import type { ReportFilters } from "@/schemas/reporting";

import { ReportGenerateModal } from "./report-generate-modal";

type Card = { key: ReportFilters["reportKey"]; title: string; modalTitle: string; tag: string; description: string; label: string; Icon: LucideIcon; tone: string };

function cards(year: string): Card[] {
  return [
    { key: "applicant-tracking", title: "Applicant Tracking", modalTitle: "Applicant Tracking Report", tag: "Recruitment", description: "Comprehensive roster of job applicants, recruitment stage progression, and screening results.", label: "Live data", Icon: UserPlus, tone: "bg-blue-50 border-blue-200 text-blue-700" },
    { key: "hiring-decisions", title: "Hiring Decisions", modalTitle: "Hiring Decisions Summary", tag: "Recruitment", description: "Final selection summaries, board approvals, and appointed personnel plantilla positions.", label: "Live data", Icon: UserCheck, tone: "bg-emerald-50 border-emerald-200 text-emerald-700" },
    { key: "employee-performance", title: "Employee Performance", modalTitle: "Employee Performance Report", tag: "Personnel 201", description: "Individual and unit performance rating metrics, commendations, and IPCR evaluation summaries.", label: "Monthly Audit", Icon: ChartLine, tone: "bg-purple-50 border-purple-200 text-purple-700" },
    { key: "deployments", title: "Duty Deployments", modalTitle: "Duty Deployments Master Report", tag: "Operations", description: "Field assignment logs, rally police duty coverage, disaster response, and sector patrol breakdowns.", label: "Real-time Data", Icon: MapPinned, tone: "bg-amber-50 border-amber-200 text-amber-700" },
    { key: "attendance-leave", title: "Attendance & Leave", modalTitle: "Attendance & Leave Summary", tag: "Attendance", description: "Biometric face-scan logs, tardiness reports, and filed leave entitlement usage history.", label: "Daily Logs", Icon: History, tone: "bg-rose-50 border-rose-200 text-rose-700" },
    { key: "promotion-training-needs", title: "Promotion & Training Needs", modalTitle: "Promotion & Training Needs Report", tag: "Career Board", description: "Rank readiness evaluations, mandatory training course gaps, and promotion board recommendations.", label: `CY ${year} Cycle`, Icon: Award, tone: "bg-teal-50 border-teal-200 text-teal-700" },
  ];
}

function downloadCsv(content: string, filename: string) {
  const href = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

/** Reports & Analytics (Capstone UI reports.html, PDF p. 34). */
export function StaffReports() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
  const [generating, setGenerating] = useState<Card | null>(null);
  const [exporting, setExporting] = useState(false);

  async function exportMasterlist() {
    if (exporting) return;
    setExporting(true);
    try {
      const rows = await listStationMasterlist();
      downloadCsv(buildMasterlistCsv(rows), `station-masterlist-${today}.csv`);
      notifyStaff({ title: "Masterlist exported" });
    } catch (cause) {
      notifyStaff({ title: "Could not export the masterlist", description: cause instanceof Error ? cause.message : undefined, tone: "error" });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageTitle
        actions={<button className={staffButton.dark} disabled={exporting} onClick={() => void exportMasterlist()} type="button"><FileSpreadsheet aria-hidden="true" className="size-3.5 text-emerald-400" /><span>Export Station Masterlist</span></button>}
        subtitle="Filter, export, or print role-appropriate personnel and operational reports."
        title="Reports & Analytics"
      />
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {cards(today.slice(0, 4)).map((card) => (
          <article className="flex flex-col justify-between space-y-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md" key={card.key}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={cn("flex size-10 items-center justify-center rounded-xl border", card.tone)}><card.Icon aria-hidden="true" className="size-4" /></div>
                <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wider text-slate-600 uppercase">{card.tag}</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">{card.title}</h2>
                <p className="mt-1 text-xs leading-relaxed font-normal text-slate-500">{card.description}</p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] font-medium text-slate-500">{card.label}</span>
              <button aria-label={`Generate ${card.title}`} className="flex items-center gap-1.5 rounded-xl bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => setGenerating(card)} type="button">
                <Printer aria-hidden="true" className="size-3" /><span>Generate</span>
              </button>
            </div>
          </article>
        ))}
      </div>
      <ReportGenerateModal key={generating?.key ?? "none"} onClose={() => setGenerating(null)} report={generating ? { key: generating.key, title: generating.modalTitle } : null} />
    </div>
  );
}
