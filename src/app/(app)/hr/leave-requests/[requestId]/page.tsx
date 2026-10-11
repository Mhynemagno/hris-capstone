import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Old links (notifications, bookmarks) open the in-place Review or Details modal on the leave page. */
export default async function HrLeaveRequestPage({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("leave_requests").select("status").eq("id", requestId).maybeSingle();
  const panel = data?.status === "pending" ? "review" : "view";
  redirect(`/hr/leave-requests?${panel}=${encodeURIComponent(requestId)}`);
}
