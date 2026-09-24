import { PromotionCriteriaManager } from "@/components/promotion-eligibility/promotion-criteria-manager";
import { PageHeader } from "@/components/ui/page-header";
export default function PromotionCriteriaPage() { return <section className="space-y-4"><PageHeader description="Define the requirements used to assess promotion readiness." eyebrow="Promotion eligibility" title="Promotion criteria" /><PromotionCriteriaManager /></section>; }
