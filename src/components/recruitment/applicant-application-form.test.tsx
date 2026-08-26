import userEvent from "@testing-library/user-event";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApplicantProfileRequiredError } from "@/queries/recruitment";
import { ApplicantApplicationForm } from "./applicant-application-form";

const submit = vi.fn();
vi.mock("@/hooks/use-recruitment", () => ({
  useSubmitApplication: () => ({ isPending: false, mutateAsync: submit }),
}));

describe("ApplicantApplicationForm", () => {
  beforeEach(() => {
    submit.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requires a CV before it starts an upload or application submission", async () => {
    const user = userEvent.setup();
    render(<ApplicantApplicationForm jobId={7} />);

    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Attach a CV before submitting.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("links legacy applicants to complete their profile before retrying", async () => {
    const user = userEvent.setup({ applyAccept: false });
    submit.mockRejectedValue(new ApplicantProfileRequiredError());
    render(<ApplicantApplicationForm jobId={7} />);

    const documentInput = screen.getByLabelText("CV and credentials") as HTMLInputElement;
    await user.upload(
      documentInput,
      new File(["CV"], "cv.pdf", { type: "application/pdf" }),
    );
    expect(documentInput.files).toHaveLength(1);
    vi.stubGlobal("FormData", class {
      get(name: string) {
        return name === "coverNote" ? "Ready to contribute." : null;
      }

      getAll(name: string) {
        return name === "documents"
          ? [new File(["CV"], "cv.pdf", { type: "application/pdf" })]
          : [];
      }
    });
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByRole("link", { name: "Complete profile" })).toHaveAttribute("href", "/applicant/profile");
  });
});
