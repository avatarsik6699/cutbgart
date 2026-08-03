import {
  type ArtifactId,
  type ArtifactLeaseOwner,
  type ArtifactMetadata,
  type ArtifactRepositoryStats,
} from "@/v2/domain";

import {
  createNativeArtifactUrlAdapter,
  type ArtifactUrlAdapter,
} from "./artifact-url-adapter";

export type ArtifactValue = Blob | ArrayBuffer | ImageBitmap | Uint8ClampedArray;

export type ArtifactRegistration = Omit<ArtifactMetadata, "id">;

export type ArtifactIdSource = {
  next(): ArtifactId;
};

export type ArtifactRepositoryOptions = {
  assertions?: "off" | "throw";
  idSource: ArtifactIdSource;
  memoryBudgetBytes: number;
  urlAdapter?: ArtifactUrlAdapter;
};

export type ArtifactObjectUrl = {
  artifactId: ArtifactId;
  owner: Extract<
    ArtifactLeaseOwner,
    { kind: "preview" | "export" | "background-preview" }
  >;
  url: string;
};

type ArtifactEntry = {
  metadata: ArtifactMetadata;
  value: ArtifactValue;
  leaseKeys: Set<string>;
};

type UrlEntry = {
  artifactId: ArtifactId;
  owner: ArtifactObjectUrl["owner"];
  ownerKey: string;
};

function ownerKey(owner: ArtifactLeaseOwner): string {
  return JSON.stringify(owner);
}

function ownerDocumentId(key: string): string | null {
  try {
    const value: unknown = JSON.parse(key);
    if (
      typeof value === "object" &&
      value !== null &&
      "documentId" in value &&
      typeof value.documentId === "string"
    ) {
      return value.documentId;
    }
  } catch {
    return null;
  }
  return null;
}

function disposeValue(value: ArtifactValue): void {
  if ("close" in value && typeof value.close === "function") {
    value.close();
  }
}

function isBlob(value: ArtifactValue): value is Blob {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

export class ArtifactRepositoryError extends Error {
  readonly code:
    | "access-after-release"
    | "budget-exceeded"
    | "double-release"
    | "duplicate-lease"
    | "invalid-metadata"
    | "invalid-promotion"
    | "leaked-artifacts"
    | "not-blob"
    | "unknown-object-url";

  constructor(code: ArtifactRepositoryError["code"], message: string) {
    super(message);
    this.name = "ArtifactRepositoryError";
    this.code = code;
  }
}

export class ArtifactRepository {
  readonly #artifacts = new Map<ArtifactId, ArtifactEntry>();
  readonly #assertions: "off" | "throw";
  readonly #idSource: ArtifactIdSource;
  readonly #memoryBudgetBytes: number;
  readonly #urlAdapter: ArtifactUrlAdapter;
  readonly #urls = new Map<string, UrlEntry>();
  readonly #releasedIds = new Set<ArtifactId>();
  #disposed = false;

  constructor(options: ArtifactRepositoryOptions) {
    if (
      !Number.isSafeInteger(options.memoryBudgetBytes) ||
      options.memoryBudgetBytes < 0
    ) {
      throw new ArtifactRepositoryError(
        "invalid-metadata",
        "Artifact memory budget must be a non-negative safe integer",
      );
    }

    this.#assertions = options.assertions ?? "throw";
    this.#idSource = options.idSource;
    this.#memoryBudgetBytes = options.memoryBudgetBytes;
    this.#urlAdapter = options.urlAdapter ?? createNativeArtifactUrlAdapter();
  }

  register(
    value: ArtifactValue,
    metadata: ArtifactRegistration,
    owner: ArtifactLeaseOwner,
  ): ArtifactId {
    this.#assertOpen();
    this.#validateMetadata(metadata);

    const nextBytes = this.stats().estimatedBytes + metadata.estimatedBytes;
    if (nextBytes > this.#memoryBudgetBytes) {
      throw new ArtifactRepositoryError(
        "budget-exceeded",
        `Artifact budget exceeded: ${nextBytes} > ${this.#memoryBudgetBytes}`,
      );
    }

    const id = this.#idSource.next();
    if (this.#artifacts.has(id)) {
      throw new ArtifactRepositoryError(
        "invalid-metadata",
        `Duplicate artifact ID: ${id}`,
      );
    }

    this.#artifacts.set(id, {
      metadata: Object.freeze({ ...metadata, id }),
      value,
      leaseKeys: new Set([ownerKey(owner)]),
    });
    return id;
  }

  metadata(id: ArtifactId): ArtifactMetadata | null {
    const entry = this.#entry(id);
    return entry === null ? null : { ...entry.metadata };
  }

  read(id: ArtifactId): ArtifactValue | null {
    const entry = this.#entry(id);
    return entry === null ? null : entry.value;
  }

  retain(id: ArtifactId, owner: ArtifactLeaseOwner): boolean {
    const entry = this.#entry(id);
    if (entry === null) {
      return false;
    }

    const key = ownerKey(owner);
    if (entry.leaseKeys.has(key)) {
      return this.#violation(
        new ArtifactRepositoryError(
          "duplicate-lease",
          `Owner already leases artifact: ${id}`,
        ),
      );
    }
    entry.leaseKeys.add(key);
    return true;
  }

  release(id: ArtifactId, owner: ArtifactLeaseOwner): boolean {
    this.#assertOpen();
    const entry = this.#artifacts.get(id);
    if (entry === undefined) {
      const code = this.#releasedIds.has(id) ? "double-release" : "access-after-release";
      return this.#violation(
        new ArtifactRepositoryError(code, `Artifact is unavailable: ${id}`),
      );
    }

    const key = ownerKey(owner);
    if (!entry.leaseKeys.delete(key)) {
      return this.#violation(
        new ArtifactRepositoryError(
          "double-release",
          `Owner does not lease artifact: ${id}`,
        ),
      );
    }
    this.#disposeIfUnreachable(id, entry);
    return true;
  }

  releaseOwnerIfPresent(owner: ArtifactLeaseOwner): number {
    const key = ownerKey(owner);
    let released = 0;

    for (const [url, entry] of [...this.#urls]) {
      if (entry.ownerKey === key) {
        this.#revokeUrl(url, entry);
      }
    }

    for (const [id, entry] of [...this.#artifacts]) {
      if (entry.leaseKeys.delete(key)) {
        released += 1;
        this.#disposeIfUnreachable(id, entry);
      }
    }
    return released;
  }

  releaseDocumentScopes(documentId: ArtifactLeaseOwner["documentId"]): number {
    const keys = new Set<string>();
    for (const entry of this.#artifacts.values()) {
      for (const key of entry.leaseKeys) {
        if (ownerDocumentId(key) === documentId) keys.add(key);
      }
    }
    let released = 0;
    for (const [url, entry] of [...this.#urls]) {
      if (keys.has(entry.ownerKey)) this.#revokeUrl(url, entry);
    }
    for (const [id, entry] of [...this.#artifacts]) {
      for (const key of keys) {
        if (entry.leaseKeys.delete(key)) released += 1;
      }
      this.#disposeIfUnreachable(id, entry);
    }
    return released;
  }

  promote(
    ids: readonly ArtifactId[],
    from: ArtifactLeaseOwner,
    to: ArtifactLeaseOwner,
  ): boolean {
    this.#assertOpen();
    const fromKey = ownerKey(from);
    const toKey = ownerKey(to);
    if (fromKey === toKey || ids.length === 0) {
      return this.#violation(
        new ArtifactRepositoryError("invalid-promotion", "Promotion owners must differ"),
      );
    }

    const uniqueIds = [...new Set(ids)];
    const entries = uniqueIds.map((id) => ({ id, entry: this.#artifacts.get(id) }));
    if (
      entries.some(
        (item) =>
          item.entry === undefined ||
          !item.entry.leaseKeys.has(fromKey) ||
          item.entry.leaseKeys.has(toKey),
      )
    ) {
      return this.#violation(
        new ArtifactRepositoryError(
          "invalid-promotion",
          "Every promoted artifact must be leased by only the source owner",
        ),
      );
    }

    for (const item of entries) {
      item.entry?.leaseKeys.add(toKey);
    }
    for (const item of entries) {
      item.entry?.leaseKeys.delete(fromKey);
    }
    return true;
  }

  createObjectUrl(
    id: ArtifactId,
    owner: ArtifactObjectUrl["owner"],
  ): ArtifactObjectUrl | null {
    const entry = this.#entry(id);
    if (entry === null) {
      return null;
    }
    if (!isBlob(entry.value)) {
      return this.#valueViolation(
        new ArtifactRepositoryError(
          "not-blob",
          `Artifact cannot back an object URL: ${id}`,
        ),
      );
    }
    if (!this.retain(id, owner)) {
      return null;
    }

    let url: string;
    try {
      url = this.#urlAdapter.create(entry.value);
    } catch (error) {
      this.release(id, owner);
      throw error;
    }
    if (this.#urls.has(url)) {
      this.release(id, owner);
      return this.#valueViolation(
        new ArtifactRepositoryError("unknown-object-url", `Duplicate object URL: ${url}`),
      );
    }
    this.#urls.set(url, { artifactId: id, owner, ownerKey: ownerKey(owner) });
    return { artifactId: id, owner, url };
  }

  releaseObjectUrl(url: string): boolean {
    const entry = this.#urls.get(url);
    if (entry === undefined) {
      return this.#violation(
        new ArtifactRepositoryError("unknown-object-url", `Unknown object URL: ${url}`),
      );
    }

    this.#revokeUrl(url, entry);
    return true;
  }

  stats(): ArtifactRepositoryStats {
    let leases = 0;
    let estimatedBytes = 0;
    for (const entry of this.#artifacts.values()) {
      leases += entry.leaseKeys.size;
      estimatedBytes += entry.metadata.estimatedBytes;
    }

    return {
      artifacts: this.#artifacts.size,
      leases,
      objectUrls: this.#urls.size,
      estimatedBytes,
    };
  }

  dispose(): void {
    if (this.#disposed) {
      return;
    }

    for (const [url, entry] of [...this.#urls]) {
      this.#revokeUrl(url, entry);
    }
    for (const entry of this.#artifacts.values()) {
      disposeValue(entry.value);
    }
    this.#artifacts.clear();
    this.#disposed = true;
  }

  assertEmpty(): void {
    const stats = this.stats();
    if (stats.artifacts !== 0 || stats.leases !== 0 || stats.objectUrls !== 0) {
      throw new ArtifactRepositoryError(
        "leaked-artifacts",
        `Artifact repository is not empty: ${JSON.stringify(stats)}`,
      );
    }
  }

  #assertOpen(): void {
    if (this.#disposed) {
      throw new ArtifactRepositoryError(
        "access-after-release",
        "Artifact repository is disposed",
      );
    }
  }

  #disposeIfUnreachable(id: ArtifactId, entry: ArtifactEntry): void {
    if (entry.leaseKeys.size !== 0) {
      return;
    }

    disposeValue(entry.value);
    this.#artifacts.delete(id);
    this.#releasedIds.add(id);
  }

  #entry(id: ArtifactId): ArtifactEntry | null {
    this.#assertOpen();
    const entry = this.#artifacts.get(id);
    if (entry !== undefined) {
      return entry;
    }

    return this.#valueViolation(
      new ArtifactRepositoryError(
        "access-after-release",
        `Artifact is unavailable: ${id}`,
      ),
    );
  }

  #revokeUrl(url: string, entry: UrlEntry): void {
    try {
      this.#urlAdapter.revoke(url);
    } finally {
      this.#urls.delete(url);
      this.release(entry.artifactId, entry.owner);
    }
  }

  #validateMetadata(metadata: ArtifactRegistration): void {
    if (
      !Number.isSafeInteger(metadata.width) ||
      metadata.width <= 0 ||
      !Number.isSafeInteger(metadata.height) ||
      metadata.height <= 0 ||
      !Number.isSafeInteger(metadata.estimatedBytes) ||
      metadata.estimatedBytes < 0
    ) {
      throw new ArtifactRepositoryError(
        "invalid-metadata",
        "Artifact dimensions must be positive integers and estimated bytes must be non-negative",
      );
    }
  }

  #violation(error: ArtifactRepositoryError): false {
    if (this.#assertions === "throw") {
      throw error;
    }
    return false;
  }

  #valueViolation(error: ArtifactRepositoryError): null {
    if (this.#assertions === "throw") {
      throw error;
    }
    return null;
  }
}
