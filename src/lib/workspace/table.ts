export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection };
type Accessor<T> = (row: T) => string | number | null | undefined;

export function parseSort(raw: string | null | undefined, allowedKeys: readonly string[], fallback: SortState): SortState {
  const [key, direction] = (raw ?? "").split(":");
  if (key && allowedKeys.includes(key) && (direction === "asc" || direction === "desc")) return { key, direction };
  return fallback;
}

export function formatSort(sort: SortState) {
  return `${sort.key}:${sort.direction}`;
}

export function nextSort(current: SortState, key: string): SortState {
  if (current.key === key) return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  return { key, direction: "asc" };
}

function compare(left: string | number, right: string | number) {
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right), "en", { sensitivity: "base", numeric: true });
}

/** Stable sort; empty values always go last whichever the direction. */
export function sortRows<T>(rows: readonly T[], sort: SortState, accessors: Record<string, Accessor<T>>): T[] {
  const accessor = accessors[sort.key];
  if (!accessor) return [...rows];
  const factor = sort.direction === "asc" ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index, value: accessor(row) }))
    .sort((a, b) => {
      const aMissing = a.value === null || a.value === undefined || a.value === "";
      const bMissing = b.value === null || b.value === undefined || b.value === "";
      if (aMissing || bMissing) return aMissing === bMissing ? a.index - b.index : aMissing ? 1 : -1;
      return compare(a.value as string | number, b.value as string | number) * factor || a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function clampPage(raw: string | number | null | undefined, pageCount: number) {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(value, Math.max(1, pageCount));
}

export function paginate<T>(rows: readonly T[], page: number, pageSize: number) {
  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = clampPage(page, pageCount);
  const start = (current - 1) * pageSize;
  const slice = rows.slice(start, start + pageSize);
  return { rows: slice, page: current, pageCount, total, from: total ? start + 1 : 0, to: start + slice.length };
}
