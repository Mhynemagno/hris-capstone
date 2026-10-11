import { notFound, redirect } from "next/navigation";

import { uuidSchema } from "@/schemas/common";

/** Promotion reviews open in the Promotions page modal (Capstone UI promotions.html). */
export default async function HrPromotionReviewPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  if (!uuidSchema.safeParse(employeeId).success) notFound();
  redirect(`/hr/promotions?review=${employeeId}`);
}
