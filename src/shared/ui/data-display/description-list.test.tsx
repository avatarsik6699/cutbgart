import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DescriptionList } from "./description-list";
import { DescriptionListItem } from "./description-list-item";

describe("DescriptionList", () => {
  it("preserves native description-list semantics", () => {
    const rendered = render(
      <DescriptionList>
        <DescriptionListItem label="runtime" value="wasm · q8" />
      </DescriptionList>,
    );

    expect(rendered.container.querySelector("dl")).not.toBeNull();
    expect(screen.getByText("runtime:").tagName).toBe("DT");
    expect(screen.getByText("wasm · q8").tagName).toBe("DD");
  });
});
