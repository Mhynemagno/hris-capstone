import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./alert-dialog";
import { Dialog, DialogContent } from "./dialog";
import { Drawer } from "./drawer";
import { RadioGroup } from "./radio-group";

describe("overlays", () => {
  it("names a dialog by its title and closes it with the Close button", async () => {
    function Harness() {
      const [open, setOpen] = useState(true);
      return <Dialog onOpenChange={setOpen} open={open}><DialogContent title="Move to stage"><p>Body</p></DialogContent></Dialog>;
    }
    render(<Harness />);
    expect(screen.getByRole("dialog", { name: "Move to stage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirms through an alertdialog and disables the confirm button while pending", async () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<ConfirmDialog confirmLabel="Withdraw" description="Applicants can no longer apply." onConfirm={onConfirm} onOpenChange={() => undefined} open title="Withdraw posting?" tone="danger" />);
    const dialog = screen.getByRole("alertdialog", { name: "Withdraw posting?" });
    expect(dialog).toHaveTextContent("Applicants can no longer apply.");
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    rerender(<ConfirmDialog confirmLabel="Withdraw" description="x" onConfirm={onConfirm} onOpenChange={() => undefined} open pending title="Withdraw posting?" tone="danger" />);
    expect(screen.getByRole("button", { name: /withdraw/i })).toBeDisabled();
  });

  it("shows a confirm error inside the dialog", () => {
    render(<ConfirmDialog confirmLabel="Go" description="d" error="Server said no" onConfirm={() => undefined} onOpenChange={() => undefined} open title="Sure?" />);
    expect(screen.getByRole("alertdialog")).toHaveTextContent("Server said no");
  });

  it("opens a drawer as a named dialog", () => {
    render(<Drawer onOpenChange={() => undefined} open title="Aplica Candidate"><p>Contact</p></Drawer>);
    expect(screen.getByRole("dialog", { name: "Aplica Candidate" })).toHaveTextContent("Contact");
  });

  it("lists radio options and reports the choice", async () => {
    const onValueChange = vi.fn();
    render(<RadioGroup legend="Next stage" name="stage" onValueChange={onValueChange} options={[{ value: "Interview", label: "Interview" }, { value: "Shortlisted", label: "Shortlisted" }]} value="" />);
    expect(screen.getByRole("radiogroup", { name: "Next stage" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Interview" }));
    expect(onValueChange).toHaveBeenCalledWith("Interview");
  });
});
