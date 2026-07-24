import type { AlphaMatte } from "../../../entities/processed-image";
import type { InteractiveEvaluationModelId, MattingQualityMeasurement } from "./types";

function assertSameSize(predicted: AlphaMatte, expected: AlphaMatte): void {
  if (
    predicted.width !== expected.width ||
    predicted.height !== expected.height ||
    predicted.data.length !== expected.data.length
  ) {
    throw new Error("Matting metrics require equally sized alpha mattes");
  }
}

function binaryMask(matte: AlphaMatte): Uint8Array {
  return Uint8Array.from(matte.data, (value) => (value >= 128 ? 1 : 0));
}

function boundaryMask(mask: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const value = mask[index];
      if (
        (x > 0 && mask[index - 1] !== value) ||
        (x + 1 < width && mask[index + 1] !== value) ||
        (y > 0 && mask[index - width] !== value) ||
        (y + 1 < height && mask[index + width] !== value)
      ) {
        result[index] = 1;
      }
    }
  }
  return result;
}

function dilate(mask: Uint8Array, width: number, height: number): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let active = false;
      for (let offsetY = -1; offsetY <= 1 && !active; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          const sampleX = x + offsetX;
          const sampleY = y + offsetY;
          if (
            sampleX >= 0 &&
            sampleX < width &&
            sampleY >= 0 &&
            sampleY < height &&
            mask[sampleY * width + sampleX] === 1
          ) {
            active = true;
            break;
          }
        }
      }
      result[y * width + x] = active ? 1 : 0;
    }
  }
  return result;
}

function maskIou(left: Uint8Array, right: Uint8Array): number {
  let intersection = 0;
  let union = 0;
  for (let index = 0; index < left.length; index += 1) {
    const inLeft = left[index] === 1;
    const inRight = right[index] === 1;
    if (inLeft && inRight) intersection += 1;
    if (inLeft || inRight) union += 1;
  }
  return union === 0 ? 1 : intersection / union;
}

function largestComponentRatio(mask: Uint8Array, width: number, height: number): number {
  const visited = new Uint8Array(mask.length);
  let largest = 0;
  for (let start = 0; start < mask.length; start += 1) {
    if (mask[start] !== 1 || visited[start] === 1) continue;
    let size = 0;
    const queue = [start];
    visited[start] = 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!;
      size += 1;
      const x = index % width;
      const neighbours = [index - width, index + width];
      if (x > 0) neighbours.push(index - 1);
      if (x + 1 < width) neighbours.push(index + 1);
      for (const neighbour of neighbours) {
        if (
          neighbour >= 0 &&
          neighbour < width * height &&
          mask[neighbour] === 1 &&
          visited[neighbour] === 0
        ) {
          visited[neighbour] = 1;
          queue.push(neighbour);
        }
      }
    }
    largest = Math.max(largest, size);
  }
  return largest / mask.length;
}

export function measureMattingQuality(input: {
  caseOrdinal: number;
  modelId: InteractiveEvaluationModelId;
  predicted: AlphaMatte;
  expected: AlphaMatte;
  interactionsToAccept?: number | null;
}): MattingQualityMeasurement {
  assertSameSize(input.predicted, input.expected);
  const predictedBinary = binaryMask(input.predicted);
  const expectedBinary = binaryMask(input.expected);
  const predictedBoundary = dilate(
    boundaryMask(predictedBinary, input.predicted.width, input.predicted.height),
    input.predicted.width,
    input.predicted.height,
  );
  const expectedBoundary = dilate(
    boundaryMask(expectedBinary, input.expected.width, input.expected.height),
    input.expected.width,
    input.expected.height,
  );

  let absoluteDifference = 0;
  let squaredDifference = 0;
  let gradientDifference = 0;
  let gradientSamples = 0;
  for (let y = 0; y < input.predicted.height; y += 1) {
    for (let x = 0; x < input.predicted.width; x += 1) {
      const index = y * input.predicted.width + x;
      const predicted = (input.predicted.data[index] ?? 0) / 255;
      const expected = (input.expected.data[index] ?? 0) / 255;
      const difference = predicted - expected;
      absoluteDifference += Math.abs(difference);
      squaredDifference += difference * difference;
      if (x + 1 < input.predicted.width) {
        const predictedGradient =
          ((input.predicted.data[index + 1] ?? 0) - (input.predicted.data[index] ?? 0)) /
          255;
        const expectedGradient =
          ((input.expected.data[index + 1] ?? 0) - (input.expected.data[index] ?? 0)) /
          255;
        gradientDifference += Math.abs(predictedGradient - expectedGradient);
        gradientSamples += 1;
      }
      if (y + 1 < input.predicted.height) {
        const predictedGradient =
          ((input.predicted.data[index + input.predicted.width] ?? 0) -
            (input.predicted.data[index] ?? 0)) /
          255;
        const expectedGradient =
          ((input.expected.data[index + input.expected.width] ?? 0) -
            (input.expected.data[index] ?? 0)) /
          255;
        gradientDifference += Math.abs(predictedGradient - expectedGradient);
        gradientSamples += 1;
      }
    }
  }

  return {
    caseOrdinal: input.caseOrdinal,
    modelId: input.modelId,
    iou: maskIou(predictedBinary, expectedBinary),
    boundaryIou: maskIou(predictedBoundary, expectedBoundary),
    sad: absoluteDifference / 1000,
    mse: squaredDifference / input.predicted.data.length,
    gradient: gradientSamples === 0 ? 0 : gradientDifference / gradientSamples,
    connectivity: Math.abs(
      largestComponentRatio(
        predictedBinary,
        input.predicted.width,
        input.predicted.height,
      ) -
        largestComponentRatio(
          expectedBinary,
          input.expected.width,
          input.expected.height,
        ),
    ),
    interactionsToAccept: input.interactionsToAccept ?? null,
  };
}
