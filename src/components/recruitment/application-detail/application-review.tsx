"use client";

import Link from "next/link";

import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { TabPanel, Tabs, useUrlTab } from "@/components/ui/tabs";
import { useBreadcrumbTrail } from "@/components/workspace-shell/breadcrumbs";
import { PageContainer } from "@/components/workspace-shell/page-container";
import { useHrRegisteredApplicants } from "@/hooks/use-applicant-portal";
import { useApplicantProfileDocumentsFor, useApplicantProfilePhotoUrl, useMyApplication } from "@/hooks/use-recruitment";
import { formatApplicantNumber } from "@/lib/recruitment/applicant-number";
import { endedAtStage } from "@/lib/recruitment/application-stages";
import type { Applicant } from "@/lib/types/database";

import { ActivityTab } from "./activity-tab";
import { ApplicationHeader } from "./application-header";
import { DetailsPanel } from "./details-panel";
import { DocumentsTab } from "./documents-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";
import { StageTracker } from "./stage-tracker";

const TABS = ["overview", "profile", "documents", "activity"] as const;

export function HrApplicationReview({ applicationId }: { applicationId: string }) {
  const result = useMyApplication(applicationId);
  const application = result.data?.application;
  const applicant = (application as unknown as { applicants?: Applicant | null } | undefined)?.applicants ?? null;
  const profileDocuments = useApplicantProfileDocumentsFor(application?.applicant_id);
  const photo = useApplicantProfilePhotoUrl(applicant?.profile_image_path ?? null);
  const registered = useHrRegisteredApplicants();
  const [tab, setTab] = useUrlTab("tab", TABS, "overview");
  const name = applicant ? [applicant.first_name, applicant.middle_name, applicant.last_name, applicant.qualifier].filter(Boolean).join(" ") : application ? `Application ${application.id.slice(0, 8)}` : "";
  useBreadcrumbTrail(name ? [{ label: name }] : []);

  if (result.isLoading) {
    return <PageContainer width="wide"><span className="sr-only" role="status">Loading application…</span><Skeleton className="h-24 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-80 w-full" /></PageContainer>;
  }
  if (result.error) return <PageContainer width="wide"><PageHeader title="Application" /><ErrorState message={result.error.message} onRetry={() => void result.refetch()} /></PageContainer>;
  if (!result.data || !application) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Application not found" />
        <EmptyState action={<Link className="font-medium text-primary hover:underline" href="/hr/applications">Back to applications</Link>} title="This application does not exist or you cannot view it." />
      </PageContainer>
    );
  }

  const { documents, history } = result.data;
  const job = result.data.application.job_openings;
  const statusChanges = history.filter((entry) => entry.previous_status !== entry.next_status);
  const lastChange = statusChanges.at(-1)?.created_at ?? null;
  const email = registered.data?.find((row) => row.applicant_id === application.applicant_id)?.email ?? null;
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const profileDocs = profileDocuments.data ?? [];

  return (
    <PageContainer width="wide">
      <ApplicationHeader
        applicantNumber={applicant?.applicant_number ?? null}
        applicationId={applicationId}
        formattedNumber={formatApplicantNumber(applicant?.applicant_number)}
        initials={initials}
        jobId={application.job_opening_id}
        jobTitle={job?.title ?? null}
        name={name}
        photoUrl={photo.data ?? null}
        stageSince={lastChange}
        status={application.status}
        submittedAt={application.submitted_at}
      />
      <StageTracker endedAt={endedAtStage(history)} status={application.status} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18.75rem] lg:items-start">
        <div className="order-2 min-w-0 lg:order-1">
          <Tabs
            items={[
              { value: "overview", label: "Overview" },
              { value: "profile", label: "Profile" },
              { value: "documents", label: "Documents", count: profileDocs.length + documents.length },
              { value: "activity", label: "Activity", count: history.length },
            ]}
            label="Application sections"
            onValueChange={setTab}
            value={tab}
          >
            <TabPanel value="overview"><OverviewTab applicationId={applicationId} coverNote={application.cover_note} history={history} onShowDocuments={() => setTab("documents")} profileDocuments={profileDocs} /></TabPanel>
            <TabPanel value="profile"><ProfileTab applicant={applicant} /></TabPanel>
            <TabPanel value="documents">{profileDocuments.error ? <ErrorState message={profileDocuments.error.message} onRetry={() => void profileDocuments.refetch()} /> : <DocumentsTab applicationDocuments={documents} profileDocuments={profileDocs} />}</TabPanel>
            <TabPanel value="activity"><ActivityTab applicationId={applicationId} history={history} /></TabPanel>
          </Tabs>
        </div>
        <div className="order-1 lg:order-2">
          <DetailsPanel email={email} jobId={application.job_opening_id} jobTitle={job?.title ?? null} lastChange={lastChange} mobile={applicant?.phone ?? null} number={formatApplicantNumber(applicant?.applicant_number)} submittedAt={application.submitted_at} />
        </div>
      </div>
    </PageContainer>
  );
}
