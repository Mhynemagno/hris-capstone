import { assertEquals, assertRejects } from "jsr:@std/assert@1";
import * as XLSX from "npm:xlsx@0.18.5";

import { CsvXlsxAttendanceAdapter } from "./attendance-adapter.ts";

const settings = { timezone: "Asia/Ulaanbaatar", templateVersion: "v1" } as const;

function csvFile(rows: string[][]) {
  return new File([rows.map((row) => row.join(",")).join("\n")], "attendance.csv", { type: "text/csv" });
}

Deno.test("normalizes a CSV attendance event without accepting a name", async () => {
  const result = await new CsvXlsxAttendanceAdapter().parse(csvFile([
    ["external_employee_id", "source_event_id", "attendance_date", "time_in", "time_out", "event_type"],
    [" dev-001 ", "EVT-001", "2026-08-24", "08:16", "17:00", "attendance"],
  ]), settings);

  assertEquals(result.events, [{
    externalEmployeeId: "DEV-001",
    sourceEventId: "EVT-001",
    attendanceDate: "2026-08-24",
    timeIn: "2026-08-24T08:16:00+08:00",
    timeOut: "2026-08-24T17:00:00+08:00",
    eventType: "attendance",
    metadata: { adapterVersion: "csv-xlsx-v1", templateVersion: "v1", rowNumber: 2 },
  }]);
});

Deno.test("accepts explicit absence but rejects a name-only row", async () => {
  const adapter = new CsvXlsxAttendanceAdapter();
  const absence = await adapter.parse(csvFile([
    ["external_employee_id", "source_event_id", "attendance_date", "time_in", "time_out", "event_type"],
    ["DEV-002", "EVT-002", "2026-08-24", "", "", "absence"],
  ]), settings);

  assertEquals(absence.events[0]?.eventType, "absence");
  await assertRejects(() => adapter.parse(csvFile([
    ["external_employee_id", "source_event_id", "attendance_date", "time_in", "time_out", "event_type", "employee_name"],
    ["", "EVT-003", "2026-08-24", "08:00", "17:00", "attendance", "Not A Matching Field"],
  ]), settings), Error, "invalid_attendance_template");
});

Deno.test("normalizes the validated XLSX export format", async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ["external_employee_id", "source_event_id", "attendance_date", "time_in", "time_out", "event_type"],
    ["DEV-003", "EVT-003", new Date("2026-08-24T00:00:00Z"), "08:00", "17:00", "attendance"],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, "Attendance");
  const file = new File([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], "attendance.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });

  const result = await new CsvXlsxAttendanceAdapter().parse(file, settings);

  assertEquals(result.events[0]?.attendanceDate, "2026-08-24");
  assertEquals(result.events[0]?.timeIn, "2026-08-24T08:00:00+08:00");
});
