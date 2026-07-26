import type {
  EditorAlphaMatte,
  EditorArtifactId,
  EditorArtifactKind,
  EditorArtifactRecord,
  EditorArtifactStoreStats,
  EditorArtifactValue,
} from "./types";

export interface EditorArtifactStoreOptions {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  createId?: () => string;
  estimateBytes?: (value: EditorArtifactValue) => number;
}

function defaultCreateId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `artifact-${String(Date.now())}-${Math.random().toString(36).slice(2)}`;
}

function isAlphaMatte(value: EditorArtifactValue): value is EditorAlphaMatte {
  return !(value instanceof Blob);
}

function estimateBytes(value: EditorArtifactValue): number {
  return isAlphaMatte(value) ? value.data.byteLength : value.size;
}

export class EditorArtifactStore {
  readonly #records = new Map<EditorArtifactId, EditorArtifactRecord>();
  readonly #owners = new Map<string, Set<EditorArtifactId>>();
  readonly #idsByValue = new WeakMap<object, EditorArtifactId>();
  readonly #createObjectURL: (blob: Blob) => string;
  readonly #revokeObjectURL: (url: string) => void;
  readonly #createId: () => string;
  readonly #estimateBytes: (value: EditorArtifactValue) => number;

  constructor(options: EditorArtifactStoreOptions = {}) {
    this.#createObjectURL =
      options.createObjectURL ??
      ((blob) => {
        if (typeof URL === "undefined" || !URL.createObjectURL)
          throw new Error("Object URLs are unavailable in this environment");
        return URL.createObjectURL(blob);
      });
    this.#revokeObjectURL =
      options.revokeObjectURL ??
      ((url) => {
        if (typeof URL !== "undefined" && URL.revokeObjectURL) URL.revokeObjectURL(url);
      });
    this.#createId = options.createId ?? defaultCreateId;
    this.#estimateBytes = options.estimateBytes ?? estimateBytes;
  }

  add(kind: EditorArtifactKind, value: EditorArtifactValue): EditorArtifactId {
    const existing = this.#idsByValue.get(value);
    if (existing && this.#records.has(existing)) return existing;
    const id = this.#createId();
    this.#records.set(id, {
      id,
      kind,
      value,
      estimatedBytes: this.#estimateBytes(value),
      objectUrl: null,
    });
    this.#idsByValue.set(value, id);
    return id;
  }

  idOf(value: EditorArtifactValue): EditorArtifactId | null {
    const id = this.#idsByValue.get(value);
    return id && this.#records.has(id) ? id : null;
  }

  get(id: EditorArtifactId): EditorArtifactRecord | null {
    return this.#records.get(id) ?? null;
  }

  getValue<T extends EditorArtifactValue>(id: EditorArtifactId): T | null {
    return (this.#records.get(id)?.value as T | undefined) ?? null;
  }

  getObjectUrl(id: EditorArtifactId): string {
    const record = this.#records.get(id);
    if (!record) throw new Error(`Unknown editor artifact: ${id}`);
    if (!(record.value instanceof Blob)) throw new Error(`Artifact ${id} is not a Blob`);
    if (record.objectUrl) return record.objectUrl;
    const objectUrl = this.#createObjectURL(record.value);
    this.#records.set(id, { ...record, objectUrl });
    return objectUrl;
  }

  replaceOwner(owner: string, artifactIds: Iterable<EditorArtifactId>): void {
    const ids = new Set(artifactIds);
    for (const id of ids) {
      if (!this.#records.has(id))
        throw new Error(`Owner ${owner} references unknown artifact ${id}`);
    }
    if (ids.size) this.#owners.set(owner, ids);
    else this.#owners.delete(owner);
    this.collect();
  }

  releaseOwner(owner: string): void {
    this.#owners.delete(owner);
    this.collect();
  }

  replaceAllOwners(owners: ReadonlyMap<string, Iterable<EditorArtifactId>>): void {
    const next = new Map<string, Set<EditorArtifactId>>();
    for (const [owner, artifactIds] of owners) {
      const ids = new Set(artifactIds);
      for (const id of ids) {
        if (!this.#records.has(id))
          throw new Error(`Owner ${owner} references unknown artifact ${id}`);
      }
      if (ids.size) next.set(owner, ids);
    }
    this.#owners.clear();
    for (const [owner, ids] of next) this.#owners.set(owner, ids);
    this.collect();
  }

  collect(): void {
    const reachable = new Set<EditorArtifactId>();
    for (const ids of this.#owners.values()) for (const id of ids) reachable.add(id);
    for (const [id, record] of this.#records) {
      if (reachable.has(id)) continue;
      if (record.objectUrl) this.#revokeObjectURL(record.objectUrl);
      this.#records.delete(id);
    }
  }

  estimatedBytes(ids: Iterable<EditorArtifactId>): number {
    let total = 0;
    const unique = new Set(ids);
    for (const id of unique) total += this.#records.get(id)?.estimatedBytes ?? 0;
    return total;
  }

  stats(): EditorArtifactStoreStats {
    let estimatedBytes = 0;
    let objectUrlCount = 0;
    for (const record of this.#records.values()) {
      estimatedBytes += record.estimatedBytes;
      if (record.objectUrl) objectUrlCount += 1;
    }
    return {
      artifactCount: this.#records.size,
      estimatedBytes,
      ownerCount: this.#owners.size,
      objectUrlCount,
    };
  }

  dispose(): void {
    this.#owners.clear();
    for (const record of this.#records.values())
      if (record.objectUrl) this.#revokeObjectURL(record.objectUrl);
    this.#records.clear();
  }
}
