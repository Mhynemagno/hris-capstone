import { HrPromotionDirectory } from "@/components/promotion-eligibility/hr-promotion-directory";
import { PageHeader } from "@/components/ui/page-header";
export default function HrPromotionsPage() { return <section className="space-y-4"><PageHeader description="Review readiness without changing an employee’s rank automatically." eyebrow="Promotion eligibility" title="Promotion reviews" /><HrPromotionDirectory /></section>; }
