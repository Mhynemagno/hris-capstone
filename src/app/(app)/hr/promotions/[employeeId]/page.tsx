import { notFound } from "next/navigation";
import { HrPromotionReview } from "@/components/promotion-eligibility/hr-promotion-review";
import { uuidSchema } from "@/schemas/common";
export default async function HrPromotionReviewPage({ params }: { params: Promise<{ employeeId: string }> }) { const { employeeId } = await params; if (!uuidSchema.safeParse(employeeId).success) notFound(); return <section className="space-y-4"><h1 className="text-3xl font-semibold">Promotion review</h1><HrPromotionReview employeeId={employeeId} /></section>; }
