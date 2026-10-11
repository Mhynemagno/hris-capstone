import { redirect } from "next/navigation";

/** The Kiosk page was removed (PDF p. 33): the kiosk opens from Attendance Logs. */
export default function KioskPage() {
  redirect("/hr/attendance?kiosk=1");
}
