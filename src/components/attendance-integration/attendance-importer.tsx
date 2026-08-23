"use client";

import { useState } from "react";

import { useImportAttendanceFile } from "@/hooks/use-attendance-integration";

export function AttendanceImporter() {
  const [file, setFile] = useState<File | null>(null); const mutation = useImportAttendanceFile();
  const supported = file && ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type) && file.size <= 2 * 1024 * 1024;
  return <section className="max-w-2xl space-y-4 rounded-xl border p-5"><div><h2 className="font-semibold">CSV/XLSX attendance import</h2><p className="mt-1 text-sm text-muted-foreground">Use the six-column v1 template. Files are limited to 2 MB and 5,000 rows.</p></div><label className="grid gap-2 text-sm font-medium">Attendance file<input accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="rounded-lg border p-2" onChange={(event) => setFile(event.target.files?.[0] ?? null)} type="file" /></label>{file && !supported ? <p className="text-sm text-destructive">Choose a CSV or XLSX file up to 2 MB.</p> : null}<button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50" disabled={!supported || mutation.isPending} onClick={() => file && mutation.mutate(file)} type="button">{mutation.isPending ? "Importing…" : "Import attendance"}</button>{mutation.error ? <p className="text-sm text-destructive">{mutation.error.message}</p> : null}{mutation.data ? <p className="rounded-lg bg-muted p-3 text-sm">Imported: {mutation.data.acceptedCount}; duplicates: {mutation.data.duplicateCount}; unmatched: {mutation.data.unmatchedCount}; invalid: {mutation.data.invalidCount}.</p> : null}</section>;
}
