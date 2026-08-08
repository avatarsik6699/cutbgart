import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ScenarioPageLayout } from "./scenario-page-layout";

afterEach(cleanup);

describe("ScenarioPageLayout", () => {
  it("keeps localized scenario copy, editor slot, and example semantics together", () => {
    render(
      <ScenarioPageLayout
        body={["First explanation", "Second explanation"]}
        example={{
          alt: "Processed example",
          caption: "Example caption",
          height: 480,
          src: "/images/example.webp",
          width: 640,
        }}
        exampleHeading="Example"
        lead="Scenario lead"
        testId="scenario-page"
        title="Scenario title"
        trust="Local processing"
      >
        <button type="button">Editor control</button>
      </ScenarioPageLayout>,
    );

    expect(screen.getByTestId("scenario-page")).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 1, name: "Scenario title" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Editor control" })).toBeTruthy();
    expect(
      screen.getByRole("img", { name: "Processed example" }).getAttribute("loading"),
    ).toBe("lazy");
    expect(screen.getByText("Example caption")).toBeTruthy();
  });
});
