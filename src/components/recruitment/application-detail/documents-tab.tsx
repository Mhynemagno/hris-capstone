"use client";

import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { formatDate } from "@/lib/format-date";
import { RESULT_LABELS } from "@/lib/recruitment/stage-results";
import type { ApplicantDocument, ApplicationStageDocument } from "@/lib/types/database";
import { getApplicantDocumentUrl, getApplicantProfileDocumentUrl, getStageDocumentUrl } from "@/queries/recruitment";
import { APPLICANT_PROFILE_DOCUMENT_KINDS } from "@/schemas/applicant-portal";

import { documentKindLabels } from "../application-status-tracker";
import { openSignedUrl } from "./open-signed-url";
import type { ProfileDocument } from "./overview-tab";

type Row = { key: string; label: string; fileName: string | null; date: string | null; open: (() => Promise<string>) | null };

function DocumentGroup({ id, onError, rows, title }: { id: string; title: string; rows: Row[]; onError: (message: string) => void }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card">
      <h3 className="border-b px-5 py-3 text-base font-semibold" id={id}>{title}</h3>
      {rows.length ? (
        <ul className="divide-y">
          {rows.map((row) => (
            <li className="flex flex-wrap items-center gap-3 px-5 py-3" key={row.key}>
              <FileText aria-hidden="true" className="size-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{row.label}</p>
                <p className="truncate text-sm text-muted-foreground">{row.fileName ? `${row.fileName} · ${formatDate(row.date)}` : "Not uploaded"}</p>
              </div>
              {row.open ? (
                <Button aria-label={`View ${row.label}: ${row.fileName}`} onClick={() => void openSignedUrl(row.open!).catch((cause) => onError(cause instanceof Error ? cause.message : "We could not open this document."))} size="sm" variant="outline">View</Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : <p className="px-5 py-4 text-sm text-muted-foreground">No documents were attached.</p>}
    </section>
  );
}

export function DocumentsTab({ applicationDocuments, profileDocuments, stageDocuments = [] }: { profileDocuments: ProfileDocument[]; applicationDocuments: ApplicantDocument[]; stageDocuments?: ApplicationStageDocument[] }) {
  const [error, setError] = useState<string | null>(null);
  const required: Row[] = APPLICANT_PROFILE_DOCUMENT_KINDS.map(({ kind, label }) => {
    const document = profileDocuments.find((item) => item.kind === kind);
    return { key: kind, label, fileName: document?.file_name ?? null, date: document?.updated_at ?? null, open: document ? () => getApplicantProfileDocumentUrl(document.object_path) : null };
  });
  const submitted: Row[] = applicationDocuments.map((document) => ({
    key: document.id,
    label: documentKindLabels[document.kind],
    fileName: document.file_name,
    date: document.created_at,
    open: async () => {
      const url = await getApplicantDocumentUrl(document.object_path);
      if (!url) throw new Error("We could not open this document.");
      return url;
    },
  }));
  const stage: Row[] = stageDocuments.map((document) => ({
    key: document.id,
    label: `${document.stage} · ${RESULT_LABELS[document.result]}`,
    fileName: document.file_name,
    date: document.created_at,
    open: () => getStageDocumentUrl(document.object_path),
  }));
  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      <DocumentGroup id="required-documents-heading" onError={setError} rows={required} title="Required profile documents" />
      <DocumentGroup id="application-documents-heading" onError={setError} rows={submitted} title="Submitted with this application" />
      {stage.length ? <DocumentGroup id="stage-documents-heading" onError={setError} rows={stage} title="Stage supporting documents" /> : null}
    </div>
  );
}
