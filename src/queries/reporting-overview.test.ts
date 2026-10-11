import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createBrowserSupabaseClient: () => ({ rpc }) }));

import { getHrDashboardOverview } from "./reporting";

describe("getHrDashboardOverview", () => {
  beforeEach(() => rpc.mockReset());

  it("parses the overview", async () => {
    rpc.mockResolvedValue({ data: {
      personnelByRank: [{ code: "PMAJ", name: "Police Major", count: 1 }, { code: null, name: null, count: 4 }],
      personnelByGender: [{ label: "male", count: 20 }, { label: "female", count: 8 }, { label: "unspecified", count: 0 }],
      attendanceToday: { present: 25, late: 1, incomplete: 1, absent: 0, onLeave: 1 },
    }, error: null });
    const overview = await getHrDashboardOverview();
    expect(rpc).toHaveBeenCalledWith("get_hr_dashboard_overview");
    expect(overview.personnelByRank[1]).toEqual({ code: null, name: null, count: 4 });
    expect(overview.attendanceToday.present).toBe(25);
  });

  it("throws the server's message", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Only HR personnel can do this." } });
    await expect(getHrDashboardOverview()).rejects.toThrow("Only HR personnel can do this.");
  });
});
