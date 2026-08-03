import { describe, expect, it } from "vitest";

import { createArtifactId, createBackgroundDraftId, createDocumentId } from "../ids";
import {
  changeBackgroundDraft,
  normalizeBackgroundFill,
  normalizeHexColor,
  sameBackgroundFill,
  TRANSPARENT_BACKGROUND,
} from "./background.policy";
import type { BackgroundDraft } from "./background.types";

describe("background policy", () => {
  it("normalizes only complete six-digit colours", () => {
    expect(normalizeHexColor(" #a1b2c3 ")).toBe("#A1B2C3");
    expect(normalizeHexColor("#fff")).toBeNull();
    expect(normalizeHexColor("not-a-colour")).toBeNull();
  });

  it("normalizes complete descriptors and rejects malformed gradient metadata", () => {
    expect(normalizeBackgroundFill({ type: "color", value: " #a1b2c3 " })).toEqual({
      type: "color",
      value: "#A1B2C3",
    });
    expect(
      normalizeBackgroundFill({
        type: "gradient",
        kind: "radial",
        stops: [
          { offset: 0, color: "#000000" },
          { offset: 0.5, color: "#FFFFFF" },
        ],
      }),
    ).toBeNull();
  });

  it("compares scalar and artifact-backed descriptors without binary values", () => {
    expect(sameBackgroundFill(TRANSPARENT_BACKGROUND, { type: "transparent" })).toBe(
      true,
    );
    expect(
      sameBackgroundFill(
        { type: "image", artifactId: createArtifactId("background-1") },
        { type: "image", artifactId: createArtifactId("background-2") },
      ),
    ).toBe(false);
    expect(
      sameBackgroundFill(
        {
          type: "gradient",
          kind: "linear",
          stops: [
            { offset: 0, color: "#000000" },
            { offset: 1, color: "#FFFFFF" },
          ],
        },
        {
          type: "gradient",
          kind: "linear",
          stops: [
            { offset: 0, color: "#000000" },
            { offset: 1, color: "#FFFFFF" },
          ],
        },
      ),
    ).toBe(true);
  });

  it("increments the draft revision without mutating the baseline", () => {
    const draft: BackgroundDraft = {
      kind: "background",
      draftId: createBackgroundDraftId("background-draft-1"),
      documentId: createDocumentId("document-1"),
      baselineRevision: 4,
      draftRevision: 2,
      fill: TRANSPARENT_BACKGROUND,
      dirty: false,
      status: "ready",
    };
    const changed = changeBackgroundDraft(draft, {
      type: "color",
      value: "#123456",
    });
    expect(changed).toMatchObject({
      baselineRevision: 4,
      draftRevision: 3,
      dirty: true,
      fill: { type: "color", value: "#123456" },
    });
    expect(draft).toMatchObject({ draftRevision: 2, dirty: false });
  });
});
