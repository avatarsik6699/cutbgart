import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Typography } from "./typography";

describe("Typography", () => {
  it("maps visual variants to deliberate semantic defaults", () => {
    render(
      <>
        <Typography variant="display">Editor</Typography>
        <Typography variant="heading-2">Result</Typography>
        <Typography variant="page-title">About</Typography>
        <Typography variant="section-title">How it works</Typography>
        <Typography variant="body">Local processing</Typography>
        <Typography variant="body-muted">Private by default</Typography>
        <Typography variant="caption-muted">No upload</Typography>
        <Typography variant="code">run-1</Typography>
      </>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Editor" })).not.toBeNull();
    expect(screen.getByRole("heading", { level: 2, name: "Result" })).not.toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "About" })).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "How it works" }),
    ).not.toBeNull();
    expect(screen.getByText("Local processing").tagName).toBe("P");
    expect(screen.getByText("Private by default").className).toContain(
      "text-muted-foreground",
    );
    expect(screen.getByText("No upload").tagName).toBe("P");
    expect(screen.getByText("run-1").tagName).toBe("CODE");
  });

  it("separates semantic element from visual appearance and forwards attributes/ref", () => {
    const ref = createRef<HTMLElement>();
    render(
      <Typography
        as="h3"
        variant="heading-1"
        id="semantic-heading"
        className="layout-class"
        ref={ref}
      >
        Preview
      </Typography>,
    );

    const heading = screen.getByRole("heading", { level: 3, name: "Preview" });
    expect(heading.getAttribute("id")).toBe("semantic-heading");
    expect(heading.className).toContain("layout-class");
    expect(heading.className).toContain("text-3xl");
    expect(ref.current).toBe(heading);
  });
});
