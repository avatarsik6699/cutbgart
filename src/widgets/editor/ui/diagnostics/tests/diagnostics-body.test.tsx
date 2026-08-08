import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DiagnosticsBody } from "../components/diagnostics-body";

describe("DiagnosticsBody", () => {
  it("renders runtime data through native description-list semantics", () => {
    const rendered = render(
      <DiagnosticsBody
        logs={[]}
        runInfo={{ inferencePath: "wasm", dtype: "q8" }}
        modelLoadBytes={{ loaded: 1_048_576, total: 2_097_152 }}
      />,
    );

    expect(rendered.container.querySelector("dl")).not.toBeNull();
    expect(screen.getByText("runtime:").tagName).toBe("DT");
    expect(screen.getByText("wasm · q8").tagName).toBe("DD");
    expect(screen.getByText("1.0 MiB / 2.0 MiB").tagName).toBe("DD");
  });
});
