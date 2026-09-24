import { notFound } from "next/navigation";
import { HrPromotionReview } from "@/components/promotion-eligibility/hr-promotion-review";
import { uuidSchema } from "@/schemas/common";
import { PageHeader } from "@/components/ui/page-header";
export default async function HrPromotionReviewPage({ params }: { params: Promise<{ employeeId: string }> }) { const { employeeId } = await params; if (!uuidSchema.safeParse(employeeId).success) notFound(); return <section className="space-y-4"><PageHeader description="Review this employee’s readiness against the promotion criteria." eyebrow="Promotion eligibility" title="Promotion review" /><HrPromotionReview employeeId={employeeId} /></section>; }
