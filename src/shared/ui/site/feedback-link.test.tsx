import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { FeedbackLink } from "./feedback-link";

afterEach(cleanup);

describe("FeedbackLink", () => {
  it("owns safe external-link attributes and supports the inline presentation", () => {
    render(<FeedbackLink variant="inline" label="Telegram" />);

    const link = screen.getByRole("link", { name: "Telegram" });
    expect(link.getAttribute("href")).toMatch(/^https:\/\/t\.me\//);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.className).toContain("underline");
  });
});
