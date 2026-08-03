import { describe, expect, it } from "vitest";

import { env } from "./env";
import { createRuntime, type RuntimeSource } from "./runtime";

function createMutableSource(): {
  source: RuntimeSource;
  setNavigator(value: Navigator | undefined): void;
  setWindow(value: Window | undefined): void;
} {
  let currentNavigator: Navigator | undefined;
  let currentWindow: Window | undefined;
  return {
    source: {
      navigator() {
        return currentNavigator;
      },
      window() {
        return currentWindow;
      },
    },
    setNavigator(value) {
      currentNavigator = value;
    },
    setWindow(value) {
      currentWindow = value;
    },
  };
}

describe("runtime boundary", () => {
  it("is SSR-safe without window or navigator", () => {
    const mutable = createMutableSource();
    const testRuntime = createRuntime(mutable.source);

    expect(testRuntime.isServer()).toBe(true);
    expect(testRuntime.isBrowser()).toBe(false);
    expect(testRuntime.window()).toBeNull();
    expect(testRuntime.navigator()).toBeNull();
  });

  it("reads runtime globals dynamically instead of freezing module-load state", () => {
    const mutable = createMutableSource();
    const testRuntime = createRuntime(mutable.source);
    const browserWindow = {} as Window;
    const browserNavigator = {} as Navigator;

    mutable.setWindow(browserWindow);
    mutable.setNavigator(browserNavigator);
    expect(testRuntime.isBrowser()).toBe(true);
    expect(testRuntime.window()).toBe(browserWindow);
    expect(testRuntime.navigator()).toBe(browserNavigator);

    mutable.setWindow(undefined);
    mutable.setNavigator(undefined);
    expect(testRuntime.isServer()).toBe(true);
  });

  it("exposes build-time values only through typed runtime methods", () => {
    const testRuntime = createRuntime(createMutableSource().source);
    expect(testRuntime.buildMode()).toBe(env.build.mode);
    expect(testRuntime.isDevelopmentBuild()).toBe(env.build.development);
    expect(testRuntime.isProductionBuild()).toBe(env.build.production);
    expect(testRuntime.isSsrBuild()).toBe(env.build.ssr);
  });
});
