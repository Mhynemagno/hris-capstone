import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({ createServerSupabaseClient: async () => ({ from: mocks.from }) }));

import { getPublishedAnnouncement } from "./published-announcement";

beforeEach(() => vi.resetAllMocks());

it("reads one announcement only while it is published", async () => {
  const id = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn().mockResolvedValue({ data: { id }, error: null }) };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  mocks.from.mockReturnValue(query);

  await expect(getPublishedAnnouncement(id)).resolves.toEqual({ id });
  expect(mocks.from).toHaveBeenCalledWith("announcements");
  expect(query.eq).toHaveBeenCalledWith("id", id);
  expect(query.eq).toHaveBeenCalledWith("status", "published");
});

it("treats an id that is not a UUID as missing, without querying", async () => {
  await expect(getPublishedAnnouncement("not-a-uuid")).resolves.toBeNull();
  expect(mocks.from).not.toHaveBeenCalled();
});
