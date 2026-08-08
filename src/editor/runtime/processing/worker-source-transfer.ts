import { ProcessingGatewayError } from "@/editor/application";
import type { ProcessingError } from "@/editor/domain";

import type { ArtifactValue } from "../artifacts";

function gatewayError(detail: ProcessingError): ProcessingGatewayError {
  return new ProcessingGatewayError(detail);
}

export async function transferableBytes(value: ArtifactValue): Promise<ArrayBuffer> {
  if (value instanceof ArrayBuffer) return value.slice(0);
  if (value instanceof Uint8ClampedArray) return value.slice().buffer;
  if (value instanceof Blob) return value.arrayBuffer();
  throw gatewayError({
    code: "artifact-unavailable",
    message: "Source artifact is not transferable encoded image data",
    retryable: false,
  });
}

export function encodedMediaType(
  mediaType: string,
): "image/jpeg" | "image/png" | "image/webp" {
  if (
    mediaType === "image/jpeg" ||
    mediaType === "image/png" ||
    mediaType === "image/webp"
  ) {
    return mediaType;
  }
  throw gatewayError({
    code: "invalid-request",
    message: `Unsupported source media type: ${mediaType}`,
    retryable: false,
  });
}
