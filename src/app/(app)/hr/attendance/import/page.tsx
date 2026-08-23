import { AttendanceImporter } from "@/components/attendance-integration/attendance-importer";

export default function AttendanceImportPage() { return <section className="space-y-4"><div><p className="text-sm font-medium text-primary">Attendance integration</p><h1 className="text-3xl font-semibold">Import attendance</h1><p className="mt-2 text-muted-foreground">Import a vendor-neutral CSV or XLSX export using stable external employee IDs.</p></div><AttendanceImporter /></section>; }
