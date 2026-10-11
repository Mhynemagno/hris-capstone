import { AttendanceIntegrationSettings } from "@/components/attendance-integration/attendance-integration-settings";
import { PageTitle } from "@/components/staff-shell/ui/page-title";

export default function AttendanceIntegrationPage() { return <section className="space-y-6"><PageTitle subtitle="Manage the CSV/XLSX attendance adapter configuration." title="Attendance Integration" /><AttendanceIntegrationSettings /></section>; }
