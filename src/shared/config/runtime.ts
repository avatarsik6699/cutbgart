import { env } from "./env";

export type RuntimeSource = {
  navigator(): Navigator | undefined;
  window(): Window | undefined;
};

export type Runtime = {
  buildMode(): string;
  isBrowser(): boolean;
  isDevelopmentBuild(): boolean;
  isProductionBuild(): boolean;
  isServer(): boolean;
  isSsrBuild(): boolean;
  navigator(): Navigator | null;
  window(): Window | null;
};

const nativeRuntimeSource: RuntimeSource = {
  navigator() {
    return typeof navigator === "undefined" ? undefined : navigator;
  },
  window() {
    return typeof window === "undefined" ? undefined : window;
  },
};

export function createRuntime(source: RuntimeSource = nativeRuntimeSource): Runtime {
  return {
    buildMode() {
      return env.build.mode;
    },
    isBrowser() {
      return source.window() !== undefined;
    },
    isDevelopmentBuild() {
      return env.build.development;
    },
    isProductionBuild() {
      return env.build.production;
    },
    isServer() {
      return source.window() === undefined;
    },
    isSsrBuild() {
      return env.build.ssr;
    },
    navigator() {
      return source.navigator() ?? null;
    },
    window() {
      return source.window() ?? null;
    },
  };
}

export const runtime = createRuntime();
