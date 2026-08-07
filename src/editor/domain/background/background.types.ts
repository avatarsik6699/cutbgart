import type { ArtifactId, BackgroundDraftId, DocumentId, Revision } from "../ids";

export declare namespace BackgroundTypes {
  type HexColor = `#${string}`;

  type GradientStop = {
    offset: 0 | 1;
    color: HexColor;
  };

  type FillDescriptor =
    | { type: "transparent" }
    | { type: "color"; value: HexColor }
    | {
        type: "gradient";
        kind: "linear" | "radial";
        stops: readonly [GradientStop & { offset: 0 }, GradientStop & { offset: 1 }];
      }
    | { type: "image"; artifactId: ArtifactId };

  type DraftStatus = "ready" | "preparing-image" | "applying" | "error";

  type Draft = {
    kind: "background";
    draftId: BackgroundDraftId;
    documentId: DocumentId;
    baselineRevision: Revision;
    draftRevision: Revision;
    fill: FillDescriptor;
    dirty: boolean;
    status: DraftStatus;
  };
}
