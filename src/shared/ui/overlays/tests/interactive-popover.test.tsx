import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CircleHelp } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";

import { InteractivePopover } from "../interactive-popover";

afterEach(cleanup);

describe("InteractivePopover", () => {
  it("owns trigger, content, dismissal, and a deliberate later focus reopen", async () => {
    render(
      <InteractivePopover
        ariaLabel="Open help"
        title="Help title"
        TriggerIcon={CircleHelp}
      >
        Help body
      </InteractivePopover>,
    );
    const trigger = screen.getByRole("button", { name: "Open help" });

    fireEvent.pointerDown(trigger);
    fireEvent.click(trigger);
    await waitFor(() => expect(screen.getByText("Help body")).toBeDefined());
    fireEvent.pointerLeave(trigger);
    await waitFor(() => expect(screen.getByText("Help body")).toBeDefined());
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() => expect(screen.queryByText("Help body")).toBeNull());

    fireEvent.blur(trigger);
    fireEvent.focus(trigger);
    await waitFor(() => expect(screen.getByText("Help body")).toBeDefined());
  });
});
