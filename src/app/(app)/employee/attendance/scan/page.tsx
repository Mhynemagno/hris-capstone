import { EmployeeFaceScan } from "@/components/face-recognition/employee-face-scan";
import { PageHeader } from "@/components/ui/page-header";

export default function EmployeeFaceScanPage() { return <section className="space-y-4"><PageHeader description="Record your time in or time out by looking at the camera and blinking once." eyebrow="Work attendance" title="Scan attendance" /><EmployeeFaceScan /></section>; }
