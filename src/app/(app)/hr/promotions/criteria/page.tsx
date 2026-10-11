import { redirect } from "next/navigation";

/** Promotion criteria are managed in the Promotions slide-over (Capstone UI promotions.html). */
export default function PromotionCriteriaPage() {
  redirect("/hr/promotions?criteria=1");
}
