import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => ({ select: vi.fn(), eq: vi.fn(), or: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: () => query }) }));

import { getRecruitmentNotice } from "./recruitment-notice";

describe("getRecruitmentNotice", () => {
  beforeEach(() => {
    for (const method of ["select", "eq", "or", "order", "limit"] as const) query[method].mockReturnValue(query);
  });

  it("names the newest open posting", async () => {
    query.maybeSingle.mockResolvedValue({ data: { title: "Patrolman / Patrolwoman (Cycle 2026)" }, error: null });
    await expect(getRecruitmentNotice()).resolves.toEqual({ title: "Patrolman / Patrolwoman (Cycle 2026)" });
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.order).toHaveBeenCalledWith("published_at", { ascending: false });
  });

  it("is empty when nothing is open", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(getRecruitmentNotice()).resolves.toBeNull();
  });

  it("treats a failed lookup as no notice rather than breaking the login page", async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: "offline" } });
    await expect(getRecruitmentNotice()).resolves.toBeNull();
  });

  it("treats a posting as open through its closing day the way the database does (UTC current_date)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T20:00:00Z")); // already October 12 in Manila
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    query.or.mockClear();
    await getRecruitmentNotice();
    expect(query.or).toHaveBeenLastCalledWith("closes_on.is.null,closes_on.gte.2026-10-11");
    vi.useRealTimers();
  });
});
