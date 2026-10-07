"use client";

import { PageHeader } from "@/components/ui/page-header";
import { TabPanel, Tabs, useUrlTab } from "@/components/ui/tabs";
import { PageContainer } from "@/components/workspace-shell/page-container";

import { HrApplications } from "./hr-applications";
import { HrRegisteredApplicants } from "./hr-registered-applicants";

export function HrApplicationsWorkspace() {
  const [view, setView] = useUrlTab("view", ["applications", "applicants"], "applications");
  return (
    <PageContainer width="wide">
      <PageHeader title="Applications" />
      <Tabs items={[{ value: "applications", label: "Applications" }, { value: "applicants", label: "Registered applicants" }]} label="Recruitment views" onValueChange={setView} value={view}>
        <TabPanel value="applications"><HrApplications /></TabPanel>
        <TabPanel value="applicants"><HrRegisteredApplicants /></TabPanel>
      </Tabs>
    </PageContainer>
  );
}
