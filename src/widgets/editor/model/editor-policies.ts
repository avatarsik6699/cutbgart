const WORKSPACE_CAPACITY = 20;

export function planImageAdmission(currentCount: number, incomingCount: number) {
  const remaining = Math.max(0, WORKSPACE_CAPACITY - currentCount);
  const acceptedCount = Math.min(incomingCount, remaining);

  return {
    entersBatchMode: currentCount + acceptedCount > 1,
    rejectedCount: Math.max(0, incomingCount - remaining),
  } as const;
}
