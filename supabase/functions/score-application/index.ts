const json = (status: number, body: Record<string, string>) =>
  Response.json(body, { status, headers: { "Content-Type": "application/json" } });

export function createScoreApplicationHandler() {
  return async (request: Request) => {
    if (request.method !== "POST") return json(405, { error: "Method not allowed." });
    return json(410, { error: "Manual analysis is no longer available." });
  };
}

if (import.meta.main) Deno.serve(createScoreApplicationHandler());
