import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FloatingConfirm } from "./FloatingConfirm";

describe("FloatingConfirm", () => {
  it("shows the hint pill, not the actions, while not ready", () => {
    render(
      <FloatingConfirm ready={false} hint="Pick 2 more">
        <button>Lock in</button>
      </FloatingConfirm>,
    );
    expect(screen.getByText("Pick 2 more")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Lock in" })).toBeNull();
  });

  it("swaps the hint for the actions once ready", () => {
    render(
      <FloatingConfirm ready hint="Pick 2 more">
        <button>Lock in</button>
      </FloatingConfirm>,
    );
    expect(screen.getByRole("button", { name: "Lock in" })).toBeInTheDocument();
    expect(screen.queryByText("Pick 2 more")).toBeNull();
  });

  it("renders nothing when not ready and no hint is given", () => {
    const { container } = render(
      <FloatingConfirm ready={false}>
        <button>Lock in</button>
      </FloatingConfirm>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
