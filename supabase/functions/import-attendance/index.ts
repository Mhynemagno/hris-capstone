import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

import { CsvXlsxAttendanceAdapter } from "../_shared/attendance-adapter.ts";

type ClientFactory = typeof createClient;
type Dependencies = { createClient?: ClientFactory; getEnv?: (name: string) => string | undefined; adapter?: CsvXlsxAttendanceAdapter };
const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function createImportAttendanceHandler({ createClient: makeClient = createClient, getEnv = (name) => Deno.env.get(name), adapter = new CsvXlsxAttendanceAdapter() }: Dependencies = {}) {
  return async (request: Request) => {
    if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (request.method !== "POST") return json(405, { error: "Method not allowed." });
    const authorization = request.headers.get("Authorization");
    if (!authorization?.match(/^Bearer\s+.+/i)) return json(401, { error: "Authentication is required." });
    const url = getEnv("SUPABASE_URL") ?? "";
    const publishableKey = getEnv("SUPABASE_PUBLISHABLE_KEY") ?? getEnv("SUPABASE_ANON_KEY") ?? "";
    if (!url || !publishableKey) return json(503, { error: "Attendance import is unavailable." });
    const client = makeClient(url, publishableKey, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace(/^Bearer\s+/i, "");
    const { data: userData, error: userError } = await client.auth.getUser(token);
    if (userError || !userData.user) return json(401, { error: "Authentication is required." });
    const { data: role, error: roleError } = await client.from("user_roles").select("role").eq("user_id", userData.user.id).maybeSingle();
    if (roleError || role?.role !== "hr_personnel") return json(403, { error: "HR access is required." });
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return json(400, { error: "A CSV or XLSX attendance file is required." });
    let importId: string | null = null;
    try {
      const bytes = await file.arrayBuffer();
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((value) => value.toString(16).padStart(2, "0")).join("");
      const parsed = await adapter.parse(file, { timezone: "Asia/Ulaanbaatar", templateVersion: "v1" });
      const { data, error: importError } = await client.rpc("create_attendance_import", { target_filename: file.name, target_mime_type: file.type, target_checksum: hash });
      importId = data as string | null;
      if (importError || !importId) throw importError ?? new Error("Attendance import could not be created.");
      const counts = { acceptedCount: 0, duplicateCount: 0, unmatchedCount: 0 };
      for (const event of parsed.events) {
        const { data: outcome, error } = await client.rpc("process_attendance_event", { target_import_id: importId, target_external_employee_id: event.externalEmployeeId, target_source_event_id: event.sourceEventId, target_attendance_date: event.attendanceDate, target_time_in: event.timeIn, target_time_out: event.timeOut, target_event_type: event.eventType, target_metadata: event.metadata });
        if (error) throw error;
        if (outcome === "inserted") counts.acceptedCount += 1;
        if (outcome === "duplicate") counts.duplicateCount += 1;
        if (outcome === "unmatched") counts.unmatchedCount += 1;
      }
      const invalidCount = 0;
      const { error: completionError } = await client.rpc("complete_attendance_import", { target_import_id: importId, target_duplicate_count: counts.duplicateCount, target_invalid_count: invalidCount });
      if (completionError) throw completionError;
      return json(200, { importId, ...counts, invalidCount, status: counts.unmatchedCount ? "completed_with_issues" : "completed" });
    } catch (error) {
      console.error("attendance_import_failed", error instanceof Error ? error.message : "unknown");
      if (importId) await client.rpc("fail_attendance_import", { target_import_id: importId, target_error_summary: "Attendance processing failed." });
      return json(importId ? 500 : 400, { error: importId ? "Attendance import failed. Please try again." : "Attendance file could not be imported." });
    }
  };
}

if (import.meta.main) Deno.serve(createImportAttendanceHandler());
