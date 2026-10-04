import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));

import {
  deleteAnnouncement,
  listPublishedAnnouncements,
  listVisibleContacts,
  reorderPublicContacts,
  saveAnnouncement,
  savePublicContact,
  setAnnouncementStatus,
} from "./public-site";

const announcementId = "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f";
const contactIds = ["4f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f", "5f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f"];

/** A chainable PostgREST query double that resolves to `result` when awaited. */
function mockQuery(result: { data: unknown; error: { message: string } | null }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  mocks.from.mockReturnValue(query);
  return query;
}

describe("public reads", () => {
  beforeEach(() => vi.resetAllMocks());

  it("lists only published announcements, newest first, limited to six", async () => {
    const query = mockQuery({ data: [{ id: announcementId }], error: null });
    await expect(listPublishedAnnouncements()).resolves.toEqual([{ id: announcementId }]);
    expect(mocks.from).toHaveBeenCalledWith("announcements");
    expect(query.select).toHaveBeenCalledWith("id, title, summary, category, published_at");
    expect(query.eq).toHaveBeenCalledWith("status", "published");
    expect(query.order).toHaveBeenCalledWith("published_at", { ascending: false });
    expect(query.limit).toHaveBeenCalledWith(6);
  });

  it("lists only visible contacts in their saved order", async () => {
    const query = mockQuery({ data: [], error: null });
    await expect(listVisibleContacts()).resolves.toEqual([]);
    expect(mocks.from).toHaveBeenCalledWith("public_contacts");
    expect(query.eq).toHaveBeenCalledWith("is_visible", true);
    expect(query.order).toHaveBeenNthCalledWith(1, "sort_order", { ascending: true });
  });

  it("surfaces a read error", async () => {
    mockQuery({ data: null, error: { message: "permission denied" } });
    await expect(listVisibleContacts()).rejects.toThrow("permission denied");
  });
});

describe("HR writes", () => {
  beforeEach(() => vi.resetAllMocks());

  it("saves a new announcement with trimmed values", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: announcementId }, error: null });
    await saveAnnouncement({ title: "  Road safety  ", category: "advisory", summary: " Summary ", body: " Body " });
    expect(mocks.rpc).toHaveBeenCalledWith("save_announcement", {
      target_announcement_id: null,
      target_title: "Road safety",
      target_summary: "Summary",
      target_body: "Body",
      target_category: "advisory",
    });
  });

  it("validates before calling the database", async () => {
    await expect(saveAnnouncement({ title: "", category: "news", summary: "S", body: "B" })).rejects.toThrow();
    await expect(setAnnouncementStatus(announcementId, "draft" as never)).rejects.toThrow();
    await expect(reorderPublicContacts(["not-a-uuid"])).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("changes status, deletes, and reports the server's message", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: { id: announcementId, status: "published" }, error: null });
    await setAnnouncementStatus(announcementId, "published");
    expect(mocks.rpc).toHaveBeenCalledWith("set_announcement_status", { target_announcement_id: announcementId, target_status: "published" });
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Only draft announcements can be deleted. Archive a published announcement instead." } });
    await expect(deleteAnnouncement(announcementId)).rejects.toThrow("Only draft announcements can be deleted.");
  });

  it("saves and reorders contacts", async () => {
    mocks.rpc.mockResolvedValue({ data: { id: contactIds[0] }, error: null });
    await savePublicContact({ kind: "phone", label: " HR Office ", value: "(02) 8123-4567", isVisible: true }, contactIds[0]);
    expect(mocks.rpc).toHaveBeenCalledWith("save_public_contact", {
      target_contact_id: contactIds[0],
      target_kind: "phone",
      target_label: "HR Office",
      target_value: "(02) 8123-4567",
      target_is_visible: true,
    });
    await reorderPublicContacts(contactIds);
    expect(mocks.rpc).toHaveBeenCalledWith("reorder_public_contacts", { ordered_contact_ids: contactIds });
  });
});
