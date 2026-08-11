import { useQueryClient } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { QueryProvider } from "./query-provider";

function QueryClientProbe() {
  const queryClient = useQueryClient();

  return <p>{queryClient ? "query-client-ready" : "query-client-missing"}</p>;
}

describe("QueryProvider", () => {
  it("makes a QueryClient available to descendants", () => {
    render(
      <QueryProvider>
        <QueryClientProbe />
      </QueryProvider>,
    );

    expect(screen.getByText("query-client-ready")).toBeInTheDocument();
  });
});
