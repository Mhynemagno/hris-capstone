import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApplicantAuthFrame } from "./applicant-auth-frame";

describe("ApplicantAuthFrame", () => {
  it("shows the open recruitment and the station branding", () => {
    render(<ApplicantAuthFrame notice={{ title: "Patrolman / Patrolwoman (Cycle 2026)" }}><p>form</p></ApplicantAuthFrame>);
    expect(screen.getByText("form")).toBeInTheDocument();
    expect(screen.getByText("SAN JUAN CITY POLICE STATION")).toBeInTheDocument();
    expect(screen.getByText("Eastern Police District • NCRPO")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "To Serve and Protect." })).toBeInTheDocument();
    expect(screen.getByText("Recruitment Notice")).toBeInTheDocument();
    expect(screen.getByText(/Current Hiring Pool for/)).toHaveTextContent("Current Hiring Pool for Patrolman / Patrolwoman (Cycle 2026) is now open for verified candidates.");
    expect(screen.getByRole("link", { name: "Help Desk" })).toHaveAttribute("href", "/#contact");
    expect(screen.getByRole("button", { name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(`© ${new Date().getFullYear()} San Juan City Police Station`)).toBeInTheDocument();
  });

  it("says when there is no active recruitment", () => {
    render(<ApplicantAuthFrame notice={null}><p>form</p></ApplicantAuthFrame>);
    expect(screen.getByText("There is no active recruitment at the moment. Please check back for new openings.")).toBeInTheDocument();
  });
});
