import { FaceEnrollmentPanel } from "@/components/face-recognition/face-enrollment-panel";
import { PageHeader } from "@/components/ui/page-header";

export default function FaceEnrollmentPage() { return <section className="space-y-4"><PageHeader description="Register a consenting employee's face for kiosk attendance. Only a numeric face template is stored — never a photo." eyebrow="Face attendance" title="Face registration" /><FaceEnrollmentPanel /></section>; }
