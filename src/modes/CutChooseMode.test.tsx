import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AppProvider } from "../context/AppContext";
import { CutChooseMode } from "./CutChooseMode";

function renderCut() {
  return render(
    <AppProvider>
      <CutChooseMode />
    </AppProvider>,
  );
}

describe("CutChooseMode session persistence", () => {
  it("survives a simulated page reload mid-lineup-build (lineup is Set-valued state)", () => {
    const { unmount } = renderCut();
    fireEvent.click(screen.getByRole("button", { name: /shuffle seats & choose warden/i }));

    const marquiseCard = screen.getByText("Marquise de Cat").closest("button")!;
    fireEvent.click(marquiseCard);
    expect(marquiseCard).toHaveClass("selected");

    unmount(); // stands in for a page refresh

    renderCut();
    expect(screen.getByText("Marquise de Cat").closest("button")).toHaveClass("selected");
    // still on the build screen, not bounced back to setup
    expect(screen.getByText(/is the Warden/i)).toBeInTheDocument();
  });
});
