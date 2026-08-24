import { redirect } from "next/navigation";

import { QueryProvider } from "@/components/providers/query-provider";
import { PublicCareersLanding } from "@/components/recruitment/public-careers-landing";
import { getCurrentRole } from "@/lib/auth/current-role";
import { getAuthenticatedUser } from "@/lib/auth/current-user";
import { getRoleHome } from "@/lib/auth/role-home";

export default async function Home() {
  const user = await getAuthenticatedUser();

  if (user) {
    const role = await getCurrentRole();
    redirect(role ? getRoleHome(role) : "/unauthorized");
  }

  return <QueryProvider><PublicCareersLanding /></QueryProvider>;
}
