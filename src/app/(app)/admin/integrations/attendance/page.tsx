import { AttendanceIntegrationSettings } from "@/components/attendance-integration/attendance-integration-settings";

export default function AttendanceIntegrationPage() { return <section className="space-y-4"><div><h1 className="text-3xl font-bold tracking-tight">Attendance Integration</h1><p className="mt-2 text-muted-foreground">Manage the CSV/XLSX attendance adapter configuration.</p></div><AttendanceIntegrationSettings /></section>; }
