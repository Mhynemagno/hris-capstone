import { notFound, redirect } from "next/navigation";

import { uuidSchema } from "@/schemas/common";

/** An employee's promotion evaluation opens in the Promotions page details view. */
export default async function HrPromotionReviewPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const { employeeId } = await params;
  if (!uuidSchema.safeParse(employeeId).success) notFound();
  redirect(`/hr/promotions?view=${employeeId}`);
}
