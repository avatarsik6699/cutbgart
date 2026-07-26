export type EditorArtifactId = string;
export type EditOperationKind = "cutout" | "manual" | "enhance" | "background";
export type EditorAutomaticModelMode = "isnet-q8" | "isnet-fp32" | "ben2-fp16";
export type EditorInferencePath = "webgpu" | "wasm";
export type EditorBackgroundFill =
  | { type: "transparent" }
  | { type: "color"; value: `#${string}` }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        { offset: 0; color: `#${string}` },
        { offset: 1; color: `#${string}` },
      ];
    }
  | { type: "image"; blob: Blob };
export interface EditorSourceImage {
  blob: Blob;
  width: number;
  height: number;
  format: "image/jpeg" | "image/png" | "image/webp";
}
export interface EditorAlphaMatte {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}
export type EditorArtifactKind =
  "alpha-matte" | "foreground" | "composite" | "background-image";

export interface EditProcessingProvenance {
  mode: EditorAutomaticModelMode;
  inferencePath: EditorInferencePath | null;
  createdAt: number;
}

export interface EditDocumentSnapshot {
  alphaMatte: EditorArtifactId;
  foreground: EditorArtifactId | null;
  composite: EditorArtifactId;
  backgroundFill: EditorBackgroundFill;
  processingMode: EditorAutomaticModelMode;
  provenance: Readonly<EditProcessingProvenance>;
}

export interface EditDocument {
  id: string;
  source: EditorSourceImage;
  baseline: Readonly<EditDocumentSnapshot>;
  current: Readonly<EditDocumentSnapshot>;
  revision: number;
}

export interface EditOperation {
  id: string;
  kind: EditOperationKind;
  label: string;
  before: Readonly<EditDocumentSnapshot>;
  after: Readonly<EditDocumentSnapshot>;
  estimatedHistoricalBytes: number;
}

export interface EditHistory {
  past: readonly EditOperation[];
  future: readonly EditOperation[];
  retainedHistoricalBytes: number;
}

export type EditorArtifactValue = EditorAlphaMatte | Blob;

export interface EditorArtifactRecord {
  id: EditorArtifactId;
  kind: EditorArtifactKind;
  value: EditorArtifactValue;
  estimatedBytes: number;
  objectUrl: string | null;
}

export interface EditorArtifactStoreStats {
  artifactCount: number;
  estimatedBytes: number;
  ownerCount: number;
  objectUrlCount: number;
}
