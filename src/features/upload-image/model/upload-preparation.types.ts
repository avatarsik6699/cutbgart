import type { UploadResult } from "./types";

// FRONTEND_CONVENTIONS.md §3.1 requires module-local shared types to be namespaced.
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace UploadPreparationTypes {
  export type Request = {
    type: "prepare";
    requestId: string;
    file: File;
  };

  export type Response = {
    type: "prepared";
    requestId: string;
    result: UploadResult;
  };

  export type PreparedUpload = {
    fileName: string;
    result: UploadResult;
  };
}
