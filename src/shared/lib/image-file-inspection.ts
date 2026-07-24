export interface EncodedImageDimensions {
  width: number;
  height: number;
}

const MAX_HEADER_BYTES = 512 * 1024;

function readUint24LE(bytes: Uint8Array, offset: number): number {
  return (
    (bytes[offset] ?? 0) |
    ((bytes[offset + 1] ?? 0) << 8) |
    ((bytes[offset + 2] ?? 0) << 16)
  );
}

function inspectJpeg(bytes: Uint8Array): EncodedImageDimensions | null {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1] ?? 0;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (marker === 0xda) return null;
    if (offset + 2 > bytes.length) return null;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);
    if (isStartOfFrame && length >= 7) {
      return {
        height: ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0),
        width: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
      };
    }
    offset += length;
  }
  return null;
}

function inspectPng(bytes: Uint8Array): EncodedImageDimensions | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (!signature.every((value, index) => bytes[index] === value)) return null;
  if (bytes.length < 24) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function inspectWebp(bytes: Uint8Array): EncodedImageDimensions | null {
  const ascii = (offset: number, value: string) =>
    Array.from(value).every(
      (character, index) => bytes[offset + index] === character.charCodeAt(0),
    );
  if (!ascii(0, "RIFF") || !ascii(8, "WEBP") || bytes.length < 30) return null;
  if (ascii(12, "VP8X")) {
    return {
      width: readUint24LE(bytes, 24) + 1,
      height: readUint24LE(bytes, 27) + 1,
    };
  }
  if (ascii(12, "VP8L") && bytes[20] === 0x2f) {
    const b0 = bytes[21] ?? 0;
    const b1 = bytes[22] ?? 0;
    const b2 = bytes[23] ?? 0;
    const b3 = bytes[24] ?? 0;
    return {
      width: 1 + b0 + ((b1 & 0x3f) << 8),
      height: 1 + ((b1 & 0xc0) >> 6) + (b2 << 2) + ((b3 & 0x0f) << 10),
    };
  }
  if (
    ascii(12, "VP8 ") &&
    bytes[23] === 0x9d &&
    bytes[24] === 0x01 &&
    bytes[25] === 0x2a
  ) {
    return {
      width: (((bytes[27] ?? 0) << 8) | (bytes[26] ?? 0)) & 0x3fff,
      height: (((bytes[29] ?? 0) << 8) | (bytes[28] ?? 0)) & 0x3fff,
    };
  }
  return null;
}

export async function inspectEncodedImageDimensions(
  file: Blob,
  type: "image/jpeg" | "image/png" | "image/webp",
): Promise<EncodedImageDimensions | null> {
  const bytes = new Uint8Array(
    await file.slice(0, Math.min(file.size, MAX_HEADER_BYTES)).arrayBuffer(),
  );
  const dimensions =
    type === "image/jpeg"
      ? inspectJpeg(bytes)
      : type === "image/png"
        ? inspectPng(bytes)
        : inspectWebp(bytes);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) return null;
  return dimensions;
}
