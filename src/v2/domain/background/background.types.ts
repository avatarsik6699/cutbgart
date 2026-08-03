import type { ArtifactId, BackgroundDraftId, DocumentId, Revision } from "../ids";

export type HexColor = `#${string}`;

export type BackgroundGradientStop = {
  offset: 0 | 1;
  color: HexColor;
};

export type BackgroundFillDescriptor =
  | { type: "transparent" }
  | { type: "color"; value: HexColor }
  | {
      type: "gradient";
      kind: "linear" | "radial";
      stops: readonly [
        BackgroundGradientStop & { offset: 0 },
        BackgroundGradientStop & { offset: 1 },
      ];
    }
  | { type: "image"; artifactId: ArtifactId };

export type BackgroundDraftStatus = "ready" | "preparing-image" | "applying" | "error";

export type BackgroundDraft = {
  kind: "background";
  draftId: BackgroundDraftId;
  documentId: DocumentId;
  baselineRevision: Revision;
  draftRevision: Revision;
  fill: BackgroundFillDescriptor;
  dirty: boolean;
  status: BackgroundDraftStatus;
};
