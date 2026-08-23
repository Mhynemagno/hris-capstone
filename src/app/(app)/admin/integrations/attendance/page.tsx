import { AttendanceIntegrationSettings } from "@/components/attendance-integration/attendance-integration-settings";

export default function AttendanceIntegrationPage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">System integrations</p><h1 className="text-3xl font-semibold">Attendance integration</h1><p className="mt-2 text-muted-foreground">Manage the CSV/XLSX attendance adapter configuration.</p></div><AttendanceIntegrationSettings /></section>; }
