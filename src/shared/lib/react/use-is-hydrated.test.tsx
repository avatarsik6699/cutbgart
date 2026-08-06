import { renderHook } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useIsHydrated } from "./use-is-hydrated";

function HydrationProbe() {
  return <span>{useIsHydrated() ? "client" : "server"}</span>;
}

describe("useIsHydrated", () => {
  it("provides a server-stable snapshot and reports the client after hydration", () => {
    expect(renderToString(<HydrationProbe />)).toContain("server");
    expect(renderHook(() => useIsHydrated()).result.current).toBe(true);
  });
});
