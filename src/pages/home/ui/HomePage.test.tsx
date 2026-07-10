import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HomePage } from "./HomePage";

interface PostedMessage {
  type: string;
  requestId?: string;
  [key: string]: unknown;
}

class MockWorker extends EventTarget {
  static instances: MockWorker[] = [];
  posted: PostedMessage[] = [];

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  postMessage(message: PostedMessage): void {
    this.posted.push(message);
  }

  terminate(): void {
    // no-op
  }

  emit(data: unknown): void {
    this.dispatchEvent(new MessageEvent("message", { data }));
  }
}

function makeFile(overrides: { type?: string; size?: number } = {}): File {
  const size = overrides.size ?? 1024;
  return new File([new Uint8Array(size)], "photo.jpg", {
    type: overrides.type ?? "image/jpeg",
  });
}

beforeEach(() => {
  MockWorker.instances = [];
  vi.stubGlobal("Worker", MockWorker);
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 800, height: 600, close: vi.fn() }),
  );
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
  cleanup();
});

describe("HomePage", () => {
  it("renders the idle state with the upload controls", () => {
    render(<HomePage />);

    expect(screen.getByTestId("home-page")).toBeDefined();
    expect(screen.getByLabelText("Upload an image")).toBeDefined();
    expect(screen.getByRole("switch")).toBeDefined();
  });

  it("shows a validation error for an unsupported file without starting the model pipeline", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile({ type: "image/gif" })] },
    });

    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/unsupported/i);
    expect(MockWorker.instances).toHaveLength(0);
  });

  it("drives upload -> process -> result -> reset without a page reload", async () => {
    render(<HomePage />);

    fireEvent.change(screen.getByLabelText("Upload an image"), {
      target: { files: [makeFile()] },
    });

    await waitFor(() => expect(MockWorker.instances).toHaveLength(1));
    const worker = MockWorker.instances[0]!;
    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "load-model")).toBe(true),
    );

    act(() => {
      worker.emit({ type: "model-ready", qualityMode: "fast" });
    });

    await waitFor(() =>
      expect(worker.posted.some((m) => m.type === "process")).toBe(true),
    );
    const processRequest = worker.posted.find((m) => m.type === "process");
    const resultBlob = new Blob(["fake-png"], { type: "image/png" });

    act(() => {
      worker.emit({
        type: "process-result",
        requestId: processRequest?.requestId,
        result: resultBlob,
      });
    });

    await waitFor(() => expect(screen.getByRole("slider")).toBeDefined());
    expect(screen.getByRole("button", { name: /download/i })).toBeDefined();
    expect(
      screen.getByRole("button", { name: /recompute in max quality/i }),
    ).toBeDefined();

    fireEvent.click(screen.getByRole("button", { name: /process another image/i }));

    await waitFor(() => expect(screen.getByLabelText("Upload an image")).toBeDefined());
  });
});
