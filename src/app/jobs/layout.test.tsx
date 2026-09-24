import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAuthenticatedUser: vi.fn(),
  getCurrentRole: vi.fn(),
}));

vi.mock("@/lib/auth/current-user", () => ({ getAuthenticatedUser: mocks.getAuthenticatedUser }));
vi.mock("@/lib/auth/current-role", () => ({ getCurrentRole: mocks.getCurrentRole }));
vi.mock("@/components/app-shell/app-shell", () => ({
  AppShell: ({ children, config, email }: { children: ReactNode; config: { role: string }; email: string | null }) => (
    <div data-email={email ?? ""} data-role={config.role} data-testid="app-shell">{children}</div>
  ),
}));
vi.mock("@/components/providers/query-provider", () => ({ QueryProvider: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/recruitment/public-site-header", () => ({ PublicSiteHeader: () => <header data-testid="public-header" /> }));

import JobsLayout from "./layout";

describe("JobsLayout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("keeps signed-in applicants inside their portal shell", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue({ id: "applicant-id", email: "applicant@example.test" });
    mocks.getCurrentRole.mockResolvedValue("applicant");

    render(await JobsLayout({ children: <p>Open jobs</p> }));

    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-role", "applicant");
    expect(screen.getByTestId("app-shell")).toHaveAttribute("data-email", "applicant@example.test");
    expect(screen.queryByTestId("public-header")).not.toBeInTheDocument();
  });

  it("keeps job browsing public and shows public navigation to visitors", async () => {
    mocks.getAuthenticatedUser.mockResolvedValue(null);

    render(await JobsLayout({ children: <p>Open jobs</p> }));

    expect(screen.getByTestId("public-header")).toBeInTheDocument();
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(screen.getByText("Open jobs")).toBeInTheDocument();
  });
});
