import type { AlphaMatte, SourceImage } from "../../../entities/processed-image";

export type SelectionPrompt =
  | { type: "point"; x: number; y: number; label: 1 }
  | { type: "box"; xMin: number; yMin: number; xMax: number; yMax: number };

export type ObjectSelectionStatus =
  | "idle"
  | "loading-model"
  | "encoding-image"
  | "ready-for-prompt"
  | "predicting-mask"
  | "preview"
  | "error";

export interface GuidedModelProfile {
  modelId: "Xenova/slimsam-77-uniform";
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4";
  dtype: "q8";
  approximateBytes: 13_840_000;
  supportedPaths: readonly ["wasm"];
  license: "Apache-2.0";
}

export const GUIDED_MODEL: GuidedModelProfile = {
  modelId: "Xenova/slimsam-77-uniform",
  revision: "7c8459c48dabad6291b384c97be46c451c25d6c4",
  dtype: "q8",
  approximateBytes: 13_840_000,
  supportedPaths: ["wasm"],
  license: "Apache-2.0",
};

export type SelectObjectWorkerRequest =
  | { type: "encode"; source: SourceImage }
  | { type: "prompt"; prompt: SelectionPrompt }
  | { type: "reset" };

export type SelectObjectWorkerResponse =
  | {
      type: "status";
      status: Exclude<ObjectSelectionStatus, "error" | "preview">;
      progress?: number;
    }
  | { type: "preview"; matte: AlphaMatte }
  | { type: "error"; message: string };
