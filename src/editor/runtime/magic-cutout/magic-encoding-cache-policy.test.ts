import { describe, expect, it } from "vitest";

import { createDocumentId } from "@/editor/domain";

import { magicEncodingCacheKey } from "./magic-encoding-cache-policy";

describe("Magic encoding cache policy", () => {
  it("reuses source encoding across committed document revisions", () => {
    const firstRevision = {
      documentId: createDocumentId("document-1"),
      mediaType: "image/png",
      width: 1024,
      height: 768,
      expectedRevision: 1,
    };
    const nextRevision = { ...firstRevision, expectedRevision: 2 };

    expect(magicEncodingCacheKey(firstRevision)).toBe(
      magicEncodingCacheKey(nextRevision),
    );
  });

  it("separates documents and source shapes", () => {
    const source = {
      documentId: createDocumentId("document-1"),
      mediaType: "image/png",
      width: 1024,
      height: 768,
    };

    expect(magicEncodingCacheKey(source)).not.toBe(
      magicEncodingCacheKey({
        ...source,
        documentId: createDocumentId("document-2"),
      }),
    );
    expect(magicEncodingCacheKey(source)).not.toBe(
      magicEncodingCacheKey({ ...source, width: 768 }),
    );
  });
});
