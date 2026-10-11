import { act, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicantToaster, notifyApplicant } from "./applicant-toaster";

describe("notifyApplicant", () => {
  it("shows a dark notice with a title and a line of text", async () => {
    render(<ApplicantToaster />);
    act(() => notifyApplicant({ title: "Document Deleted", description: "CV / Resume has been removed." }));
    const notice = await screen.findByRole("status");
    expect(notice).toHaveTextContent("Document Deleted");
    expect(notice).toHaveTextContent("CV / Resume has been removed.");
  });

  it("announces errors as alerts", async () => {
    render(<ApplicantToaster />);
    act(() => notifyApplicant({ title: "Document not deleted", description: "Upload a replacement instead.", tone: "error" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Upload a replacement instead.");
  });
});
