import { redirect } from "next/navigation";

/** Old "request leave" links now open the File Leave Application modal on the leave portal. */
export default function NewLeavePage() {
  redirect("/employee/leave?request=1");
}
