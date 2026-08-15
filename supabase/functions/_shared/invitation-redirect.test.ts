import { assertEquals } from "jsr:@std/assert@1";

import { getInvitationRedirectUrl } from "./invitation-redirect.ts";

Deno.test("creates the configured application callback URL", () => {
  assertEquals(
    getInvitationRedirectUrl("https://hris.example"),
    "https://hris.example/auth/callback?next=/reset-password",
  );
});

Deno.test("rejects an absent, pathful, or non-HTTP application URL", () => {
  assertEquals(getInvitationRedirectUrl(undefined), null);
  assertEquals(getInvitationRedirectUrl("https://hris.example/admin"), null);
  assertEquals(getInvitationRedirectUrl("ftp://hris.example"), null);
});
