import { FaceAttendanceKiosk } from "@/components/face-recognition/face-attendance-kiosk";
import { PageHeader } from "@/components/ui/page-header";

export default function FaceAttendanceKioskPage() { return <section className="space-y-4"><PageHeader description="Run on a supervised device. Employees look at the camera; they never choose their name." title="Attendance kiosk" /><FaceAttendanceKiosk /></section>; }
