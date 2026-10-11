import { afterEach, describe, expect, it, vi } from "vitest";

const createBrowserClient = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createBrowserClient }));
vi.mock("./env", () => ({ getPublicSupabaseConfig: () => ({ url: "http://127.0.0.1:54321", publishableKey: "key" }) }));

import { createBrowserSupabaseClient } from "./client";

describe("createBrowserSupabaseClient cookies", () => {
  afterEach(() => { document.cookie = "bad=; Max-Age=0; Path=/"; });

  it("reads cookies even when another cookie is not valid percent-encoding", () => {
    document.cookie = "bad=%E0%A4%A; Path=/";
    document.cookie = "sb-test=ok; Path=/";
    createBrowserSupabaseClient();
    const options = createBrowserClient.mock.calls.at(-1)![2] as { cookies: { getAll: () => { name: string; value: string }[] } };
    const cookies = options.cookies.getAll();
    expect(cookies).toContainEqual({ name: "sb-test", value: "ok" });
    expect(cookies).toContainEqual({ name: "bad", value: "%E0%A4%A" });
  });
});
