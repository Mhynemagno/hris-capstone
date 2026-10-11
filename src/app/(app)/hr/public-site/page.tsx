import { Suspense } from "react";

import { StaffAnnouncements } from "@/components/public-site/staff-announcements";

export default function HrPublicSitePage() {
  return <Suspense><StaffAnnouncements /></Suspense>;
}
