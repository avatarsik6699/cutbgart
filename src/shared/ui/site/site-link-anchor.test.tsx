import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { SiteLinkAnchor } from "./site-link-anchor";

afterEach(cleanup);

describe("SiteLinkAnchor", () => {
  it("applies navigation and explicit active styles without dropping anchor attributes", () => {
    render(
      <SiteLinkAnchor
        href="/about"
        variant="navigation"
        forceActive
        aria-label="About"
      />,
    );

    const link = screen.getByRole("link", { name: "About" });
    expect(link.getAttribute("href")).toBe("/about");
    expect(link.className).toContain("hover:text-foreground");
    expect(link.className).toContain("font-semibold");
  });
});
