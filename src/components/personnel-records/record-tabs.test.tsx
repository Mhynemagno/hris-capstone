import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { parseRecordTab, RecordTabs } from "./record-tabs";

describe("parseRecordTab", () => {
  it("falls back to the official record for missing or unknown tabs", () => {
    expect(parseRecordTab(null)).toBe("official");
    expect(parseRecordTab("nonsense")).toBe("official");
    expect(parseRecordTab("training")).toBe("training");
    expect(parseRecordTab("service-history")).toBe("service-history");
  });
});

describe("RecordTabs", () => {
  it("renders an accessible tablist and reports the chosen tab", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecordTabs active="official" idPrefix="rec" onChange={onChange} />);

    expect(screen.getByRole("tablist", { name: "Personnel record sections" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Official record", "Service history", "Qualifications", "Certifications", "Training"]);
    expect(screen.getByRole("tab", { name: "Official record" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Service history" })).toHaveAttribute("tabindex", "-1");

    await user.click(screen.getByRole("tab", { name: "Service history" }));
    expect(onChange).toHaveBeenCalledWith("service-history");
  });

  it("moves between tabs with the arrow, Home, and End keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecordTabs active="official" idPrefix="rec" onChange={onChange} />);

    screen.getByRole("tab", { name: "Official record" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("service-history");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("official");
    await user.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("training");
    await user.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith("official");
    await user.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith("training");
  });

  it("supports vertical arrow keys and shows record counts without changing tab names", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<RecordTabs active="official" counts={{ training: 3 }} idPrefix="rec" onChange={onChange} orientation="responsive" />);

    expect(screen.getByRole("tab", { name: "Training" })).toHaveTextContent("Training3");
    screen.getByRole("tab", { name: "Official record" }).focus();
    await user.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith("service-history");
    await user.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith("official");
  });
});
