import { describe, expect, it } from "vitest";

import { captureResourceSnapshot } from "./resource-probe";

describe("resource lifetime probe", () => {
  it("maps repository counts and keeps unavailable runtime counts explicit", () => {
    expect(
      captureResourceSnapshot({
        point: "after-cancel",
        artifacts: {
          stats: () => ({ artifacts: 0, leases: 0, objectUrls: 0, estimatedBytes: 0 }),
        },
        runtime: { workers: 1, sessions: 0, listeners: null },
      }),
    ).toEqual({
      point: "after-cancel",
      artifactCount: 0,
      leaseCount: 0,
      byteCount: 0,
      objectUrlCount: 0,
      workerCount: 1,
      sessionCount: 0,
      listenerCount: null,
    });
  });
});
