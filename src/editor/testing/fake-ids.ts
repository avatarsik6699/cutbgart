export type DeterministicIdSource<TId> = {
  next(): TId;
  remaining(): number;
};

export function createDeterministicIds<TId>(
  ids: readonly TId[],
): DeterministicIdSource<TId> {
  let index = 0;
  return {
    next() {
      const id = ids[index];
      if (id === undefined) throw new Error("No deterministic ID remains");
      index += 1;
      return id;
    },
    remaining: () => ids.length - index,
  };
}
