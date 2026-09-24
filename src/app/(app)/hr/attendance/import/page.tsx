import { AttendanceImporter } from "@/components/attendance-integration/attendance-importer";
import { PageHeader } from "@/components/ui/page-header";

export default function AttendanceImportPage() { return <section className="space-y-4"><PageHeader description="Import a vendor-neutral CSV or XLSX export using stable external employee IDs." eyebrow="Attendance integration" title="Import attendance" /><AttendanceImporter /></section>; }
