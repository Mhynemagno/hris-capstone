import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ApplicantApplicationForm } from "./applicant-application-form";

const submit = vi.fn();
vi.mock("@/hooks/use-recruitment", () => ({
  useSubmitApplication: () => ({ isPending: false, mutateAsync: submit }),
}));

describe("ApplicantApplicationForm", () => {
  it("requires a CV before it starts an upload or application submission", async () => {
    const user = userEvent.setup();
    render(<ApplicantApplicationForm jobId={7} />);

    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Attach a CV before submitting.");
    expect(submit).not.toHaveBeenCalled();
  });
});
