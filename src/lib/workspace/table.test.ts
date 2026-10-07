import { describe, expect, it } from "vitest";

import { clampPage, formatSort, nextSort, paginate, parseSort, sortRows } from "./table";

const fallback = { key: "submitted", direction: "desc" } as const;

describe("table helpers", () => {
  it("parses a valid sort and rejects junk", () => {
    expect(parseSort("name:asc", ["name", "submitted"], fallback)).toEqual({ key: "name", direction: "asc" });
    expect(parseSort("nope:asc", ["name"], fallback)).toEqual(fallback);
    expect(parseSort("name:sideways", ["name"], fallback)).toEqual(fallback);
    expect(parseSort(null, ["name"], fallback)).toEqual(fallback);
    expect(formatSort({ key: "name", direction: "desc" })).toBe("name:desc");
  });

  it("toggles direction on the same column and starts ascending on a new one", () => {
    expect(nextSort({ key: "name", direction: "asc" }, "name")).toEqual({ key: "name", direction: "desc" });
    expect(nextSort({ key: "name", direction: "desc" }, "score")).toEqual({ key: "score", direction: "asc" });
  });

  it("sorts with nulls last in both directions and keeps ties stable", () => {
    const rows = [{ id: 1, v: 5 }, { id: 2, v: null }, { id: 3, v: 9 }, { id: 4, v: 5 }];
    const accessors = { v: (row: (typeof rows)[number]) => row.v };
    expect(sortRows(rows, { key: "v", direction: "asc" }, accessors).map((r) => r.id)).toEqual([1, 4, 3, 2]);
    expect(sortRows(rows, { key: "v", direction: "desc" }, accessors).map((r) => r.id)).toEqual([3, 1, 4, 2]);
  });

  it("sorts text case-insensitively", () => {
    const rows = [{ n: "beta" }, { n: "Alpha" }];
    expect(sortRows(rows, { key: "n", direction: "asc" }, { n: (r) => r.n }).map((r) => r.n)).toEqual(["Alpha", "beta"]);
  });

  it("clamps junk and out-of-range pages", () => {
    expect(clampPage("999", 3)).toBe(3);
    expect(clampPage("abc", 3)).toBe(1);
    expect(clampPage("-2", 3)).toBe(1);
    expect(clampPage(undefined, 0)).toBe(1);
  });

  it("paginates with 1-based from/to", () => {
    const result = paginate(Array.from({ length: 60 }, (_, i) => i), 3, 25);
    expect(result).toMatchObject({ page: 3, pageCount: 3, total: 60, from: 51, to: 60 });
    expect(result.rows).toHaveLength(10);
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pageCount: 1, total: 0, from: 0, to: 0, rows: [] });
  });
});
