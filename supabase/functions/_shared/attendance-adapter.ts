import * as XLSX from "npm:xlsx@0.18.5";

export type AttendanceAdapterSettings = { timezone: "Asia/Ulaanbaatar"; templateVersion: "v1" };
export type NormalizedAttendanceEvent = {
  externalEmployeeId: string;
  sourceEventId: string;
  attendanceDate: string;
  timeIn: string | null;
  timeOut: string | null;
  eventType: "attendance" | "absence";
  metadata: { adapterVersion: "csv-xlsx-v1"; templateVersion: "v1"; rowNumber: number };
};

const headers = ["external_employee_id", "source_event_id", "attendance_date", "time_in", "time_out", "event_type"] as const;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

function invalidTemplate(): never { throw new Error("invalid_attendance_template"); }

function readTime(date: string, value: string, required: boolean) {
  const time = value.trim();
  if (!time) return required ? invalidTemplate() : null;
  if (!timePattern.test(time)) invalidTemplate();
  return `${date}T${time.length === 5 ? `${time}:00` : time}+08:00`;
}

function readDate(value: string) {
  if (datePattern.test(value)) return value;
  if (/^\d+(?:\.\d+)?$/.test(value)) return new Date(Date.UTC(1899, 11, 30) + Number(value) * 86_400_000).toISOString().slice(0, 10);
  return value;
}

export class CsvXlsxAttendanceAdapter {
  async parse(file: File, settings: AttendanceAdapterSettings): Promise<{ events: NormalizedAttendanceEvent[] }> {
    if (file.size === 0 || file.size > 2 * 1024 * 1024 || !["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(file.type)) invalidTemplate();
    let rows: unknown[][];
    if (file.type === "text/csv") {
      rows = (await file.text()).trim().split(/\r?\n/).map((line) => line.split(","));
    } else {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
      if (!firstSheet) invalidTemplate();
      rows = XLSX.utils.sheet_to_json<unknown[]>(firstSheet, { header: 1, defval: "", raw: true });
    }
    const header = rows[0]?.map((value) => String(value).trim()) ?? [];
    if (header.length !== headers.length || headers.some((value, index) => header[index] !== value) || rows.length - 1 > 5000) invalidTemplate();
    const events = rows.slice(1).filter((row) => row.some((value) => String(value).trim())).map((row, index) => {
      if (row.length !== headers.length) invalidTemplate();
      const [external, event, dateValue, timeInValue, timeOutValue, eventTypeValue] = row.map((value) => String(value).trim());
      const date = readDate(dateValue);
      const externalEmployeeId = external.toUpperCase();
      const sourceEventId = event;
      const eventType = eventTypeValue as "attendance" | "absence";
      if (!externalEmployeeId || externalEmployeeId.length > 64 || !sourceEventId || sourceEventId.length > 128 || !datePattern.test(date) || !["attendance", "absence"].includes(eventType)) invalidTemplate();
      const timeIn = readTime(date, timeInValue, eventType === "attendance");
      const timeOut = readTime(date, timeOutValue, false);
      if ((eventType === "absence" && (timeIn || timeOut)) || (timeIn && timeOut && timeOut < timeIn)) invalidTemplate();
      return { externalEmployeeId, sourceEventId, attendanceDate: date, timeIn, timeOut, eventType, metadata: { adapterVersion: "csv-xlsx-v1" as const, templateVersion: settings.templateVersion, rowNumber: index + 2 } };
    });
    return { events };
  }
}
