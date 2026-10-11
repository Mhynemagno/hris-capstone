"use client";

import { Download, FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { staffButton } from "@/components/staff-shell/ui/staff-buttons";
import { StaffInput, StaffLabel, StaffSelect } from "@/components/staff-shell/ui/staff-fields";
import { StaffModal } from "@/components/staff-shell/ui/staff-modal";
import { useDepartmentOptions } from "@/hooks/use-administration";
import { reportGenerateHref, type ReportExportFormat } from "@/lib/reporting/masterlist";
import type { ReportFilters } from "@/schemas/reporting";

function manilaToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());
}

/** "Generate Report" (Capstone UI reports.html): date range, sub-unit and export format, then the report page prints or downloads. */
export function ReportGenerateModal({ report, onClose }: { report: { key: ReportFilters["reportKey"]; title: string } | null; onClose: () => void }) {
  const router = useRouter();
  const departments = useDepartmentOptions();
  const today = manilaToday();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const [departmentId, setDepartmentId] = useState("");
  const [format, setFormat] = useState<ReportExportFormat>("pdf");
  const [error, setError] = useState<string | null>(null);

  function generate() {
    if (!report) return;
    if (!from || !to) { setError("Choose both dates."); return; }
    if (from > to) { setError("Start date must be on or before the end date."); return; }
    router.push(reportGenerateHref(report.key, { from, to, departmentId: departmentId ? Number(departmentId) : null, format }));
  }

  return (
    <StaffModal
      footer={(
        <>
          <button className={staffButton.secondary} onClick={onClose} type="button">Cancel</button>
          <button className={staffButton.primary} onClick={generate} type="button"><Download aria-hidden="true" className="size-3.5" /><span>Download Official Report</span></button>
        </>
      )}
      icon={<FileText aria-hidden="true" className="size-4" />}
      iconClassName="bg-blue-900 text-amber-400 shadow-sm"
      onClose={onClose}
      open={report !== null}
      size="2xl"
      subtitle="Configure parameters and print official PNP station document"
      title={report?.title ?? "Generate Report"}
    >
      <div className="space-y-4 font-semibold text-slate-700">
        <div className="space-y-1 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-center">
          <p className="text-[10px] font-extrabold tracking-widest text-slate-500 uppercase">Republic of the Philippines • PNP</p>
          <p className="text-sm font-black text-slate-900 uppercase">SAN JUAN CITY POLICE STATION</p>
          <p className="text-[11px] font-bold text-blue-700">Human Resource and Doctrine Development Section</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <StaffLabel htmlFor="report-from" required>Date Range From</StaffLabel>
            <StaffInput id="report-from" onChange={(event) => { setFrom(event.target.value); setError(null); }} type="date" value={from} />
          </div>
          <div className="space-y-1">
            <StaffLabel htmlFor="report-to" required>Date Range To</StaffLabel>
            <StaffInput id="report-to" onChange={(event) => { setTo(event.target.value); setError(null); }} type="date" value={to} />
          </div>
        </div>
        {error ? <p className="text-[10px] font-bold text-rose-500" role="alert">{error}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <StaffLabel htmlFor="report-unit">Station Sub-Unit / Sector</StaffLabel>
            <StaffSelect id="report-unit" onChange={(event) => setDepartmentId(event.target.value)} value={departmentId}>
              <option value="">All Station Sections</option>
              {(departments.data ?? []).filter((department) => department.is_active).map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </StaffSelect>
          </div>
          <div className="space-y-1">
            <StaffLabel htmlFor="report-format">Export Format</StaffLabel>
            <StaffSelect id="report-format" onChange={(event) => setFormat(event.target.value as ReportExportFormat)} value={format}>
              <option value="pdf">PDF Document (.pdf)</option>
              <option value="csv">Excel Spreadsheet (.csv)</option>
              <option value="print">Direct Print View</option>
            </StaffSelect>
          </div>
        </div>
      </div>
    </StaffModal>
  );
}
