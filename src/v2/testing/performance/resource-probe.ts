import type { ArtifactRepositoryStats } from "@/v2/domain";

import type { ArtifactSample } from "./report";

export type ArtifactStatsSource = {
  stats(): ArtifactRepositoryStats;
};

export type RuntimeResourceCounts = {
  workers: number | null;
  sessions: number | null;
  listeners: number | null;
};

export function captureResourceSnapshot(input: {
  point: string;
  artifacts: ArtifactStatsSource;
  runtime: RuntimeResourceCounts;
}): ArtifactSample {
  const stats = input.artifacts.stats();
  return {
    point: input.point,
    artifactCount: stats.artifacts,
    leaseCount: stats.leases,
    byteCount: stats.estimatedBytes,
    objectUrlCount: stats.objectUrls,
    workerCount: input.runtime.workers,
    sessionCount: input.runtime.sessions,
    listenerCount: input.runtime.listeners,
  };
}
