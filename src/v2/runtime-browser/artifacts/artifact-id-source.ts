import { createArtifactId } from "@/v2/domain";

import type { ArtifactIdSource } from "./artifact-repository";

export function createNativeArtifactIdSource(
  randomUuid: () => string = () => crypto.randomUUID(),
): ArtifactIdSource {
  return {
    next() {
      return createArtifactId(randomUuid());
    },
  };
}
