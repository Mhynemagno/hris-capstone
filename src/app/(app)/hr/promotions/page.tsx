import { Suspense } from "react";

import { StaffPromotions } from "@/components/promotion-eligibility/staff-promotions";

export default function HrPromotionsPage() {
  return <Suspense><StaffPromotions /></Suspense>;
}
