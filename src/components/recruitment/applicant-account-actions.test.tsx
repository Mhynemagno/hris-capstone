import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({
  useReopenApplicationForResubmission: vi.fn(),
  useSendApplicantCredentials: vi.fn(() => ({ isPending: false, mutateAsync: vi.fn() })),
}));

vi.mock("@/hooks/use-applicant-portal", () => hooks);
vi.mock("@/components/ui/toaster", () => ({ notifySuccess: vi.fn() }));

import { ApplicantAccountActions } from "./applicant-account-actions";

describe("ApplicantAccountActions", () => {
  it("explains that rejection access returns automatically and does not offer manual reactivation", () => {
    render(<ApplicantAccountActions active email="applicant@example.test" />);

    expect(screen.getByText(/regains access automatically after the six-month cooling-off period/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reactivate/i })).not.toBeInTheDocument();
  });
});
