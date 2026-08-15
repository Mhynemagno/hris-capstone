import { assertEquals } from "jsr:@std/assert@1";

import { createDeleteManagedUserHandler } from "./index.ts";

const actorId = "123e4567-e89b-42d3-a456-426614174000";
const targetId = "223e4567-e89b-42d3-a456-426614174000";

function deleteRequest(userId: string, method = "DELETE") {
  return new Request(
    "https://project.supabase.co/functions/v1/delete-managed-user",
    {
      method,
      headers: {
        Authorization: "Bearer access-token",
        "Content-Type": "application/json",
      },
      body: method === "DELETE" ? JSON.stringify({ userId }) : undefined,
    },
  );
}

function createHandler(
  options: { administrator?: boolean; deleteError?: Error | null } = {},
) {
  let deleteUserCalls = 0;
  let auditInsert: Record<string, unknown> | null = null;
  const callerClient = {
    auth: {
      getUser: async () => ({ data: { user: { id: actorId } }, error: null }),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              role: options.administrator === false
                ? "employee"
                : "system_administrator",
            },
            error: null,
          }),
        }),
      }),
    }),
  };
  const adminClient = {
    auth: {
      admin: {
        deleteUser: async () => {
          deleteUserCalls += 1;
          return { error: options.deleteError ?? null };
        },
      },
    },
    from: (table: string) =>
      table === "profiles"
        ? {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: targetId,
                  full_name: "Officer Ada Lovelace",
                  email: "ada@example.com",
                },
                error: null,
              }),
            }),
          }),
        }
        : {
          insert: async (value: Record<string, unknown>) => {
            auditInsert = value;
            return { error: null };
          },
        },
  };
  const environment: Record<string, string> = {
    SUPABASE_URL: "https://project.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "public-key",
    SUPABASE_SECRET_KEY: "secret-key",
  };
  const handler = createDeleteManagedUserHandler({
    createClient: (_url: string, key: string) =>
      key === "secret-key" ? adminClient : callerClient,
    getEnv: (name: string) => environment[name],
  });
  return {
    handler,
    getAuditInsert: () => auditInsert,
    getDeleteUserCalls: () => deleteUserCalls,
  };
}

Deno.test("rejects self deletion before calling the admin client", async () => {
  const { handler, getDeleteUserCalls } = createHandler();

  const response = await handler(deleteRequest(actorId));

  assertEquals(response.status, 400);
  assertEquals(await response.json(), {
    error: "You cannot delete your own account.",
  });
  assertEquals(getDeleteUserCalls(), 0);
});

Deno.test("rejects callers without the administrator role", async () => {
  const { handler, getDeleteUserCalls } = createHandler({
    administrator: false,
  });

  const response = await handler(deleteRequest(targetId));

  assertEquals(response.status, 403);
  assertEquals(await response.json(), {
    error: "Administrator access is required.",
  });
  assertEquals(getDeleteUserCalls(), 0);
});

Deno.test("deletes a selected account and writes a readable audit row", async () => {
  const { handler, getAuditInsert, getDeleteUserCalls } = createHandler();

  const response = await handler(deleteRequest(targetId));

  assertEquals(response.status, 204);
  assertEquals(getDeleteUserCalls(), 1);
  assertEquals(getAuditInsert(), {
    actor_user_id: actorId,
    entity_type: "profiles",
    entity_id: targetId,
    action: "delete",
    metadata: { full_name: "Officer Ada Lovelace", email: "ada@example.com" },
  });
});
