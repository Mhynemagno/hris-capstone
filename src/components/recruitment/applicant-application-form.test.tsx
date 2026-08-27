import userEvent from "@testing-library/user-event";
import { render, screen, waitFor } from "@testing-library/react";
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

    expect(screen.getByRole("alert")).toHaveTextContent("Attach your CV as a PDF before submitting.");
    expect(submit).not.toHaveBeenCalled();
  });

  it("links legacy applicants to complete their profile before retrying", async () => {
    const user = userEvent.setup({ applyAccept: false });
    submit.mockRejectedValue(new ApplicantProfileRequiredError());
    render(<ApplicantApplicationForm jobId={7} />);

    const documentInput = screen.getByLabelText("CV (PDF)") as HTMLInputElement;
    await user.upload(
      documentInput,
      new File(["CV"], "cv.pdf", { type: "application/pdf" }),
    );
    expect(documentInput.files).toHaveLength(1);
    const submittedCv = new File(["CV"], "cv.pdf", { type: "application/pdf" });
    vi.stubGlobal("FormData", class {
      get(name: string) {
        if (name === "coverNote") return "Ready to contribute.";
        if (name === "cv") return submittedCv;
        return null;
      }

      getAll(name: string) {
        return name === "credentials" ? [] : [];
      }
    });
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    expect(await screen.findByRole("link", { name: "Complete profile" })).toHaveAttribute("href", "/applicant/profile");
  });

  it("keeps the PDF CV distinct from optional credentials and shows a tracking link", async () => {
    const user = userEvent.setup({ applyAccept: false });
    submit.mockResolvedValue("223e4567-e89b-42d3-a456-426614174000");
    render(<ApplicantApplicationForm jobId={7} />);

    const cv = new File(["CV"], "resume.pdf", { type: "application/pdf" });
    const credential = new File(["certificate"], "certificate.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("CV (PDF)"), cv);
    await user.upload(screen.getByLabelText("Credentials (optional)"), credential);
    vi.stubGlobal("FormData", class {
      get(name: string) {
        if (name === "cv") return cv;
        if (name === "coverNote") return "";
        return null;
      }

      getAll(name: string) {
        return name === "credentials" ? [credential] : [];
      }
    });
    await user.click(screen.getByRole("button", { name: "Submit application" }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      documents: [
        { kind: "cv", file: cv },
        { kind: "credential", file: credential },
      ],
    })));
    expect(await screen.findByRole("status")).toHaveTextContent("Application submitted");
    expect(screen.getByRole("link", { name: "Track application" })).toHaveAttribute("href", "/applicant/applications/223e4567-e89b-42d3-a456-426614174000");
  });
});
