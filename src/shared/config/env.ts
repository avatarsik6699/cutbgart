export type PublicClientEnv = {
  analytics: {
    cfBeaconToken: string | undefined;
    umamiScriptUrl: string | undefined;
    umamiWebsiteId: string | undefined;
  };
  model: {
    cdnBaseUrl: string | undefined;
    labEnabled: boolean;
    onnxRuntimeWebVersion: "1.27.0";
  };
};

export type BuildEnv = {
  development: boolean;
  mode: string;
  production: boolean;
  ssr: boolean;
};

export type PublicEnvSource = {
  VITE_CF_BEACON_TOKEN?: unknown;
  VITE_ENABLE_MODEL_LAB?: unknown;
  VITE_MODEL_CDN_BASE_URL?: unknown;
  VITE_UMAMI_SCRIPT_URL?: unknown;
  VITE_UMAMI_WEBSITE_ID?: unknown;
};

export class EnvValidationError extends Error {
  readonly key: keyof PublicEnvSource;

  constructor(key: keyof PublicEnvSource, message: string) {
    super(`${key}: ${message}`);
    this.name = "EnvValidationError";
    this.key = key;
  }
}

function optionalString(
  source: PublicEnvSource,
  key: keyof PublicEnvSource,
): string | undefined {
  const value = source[key];
  if (value === undefined || value === "") {
    return undefined;
  }
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EnvValidationError(key, "must be a non-empty string when provided");
  }
  return value.trim();
}

function optionalHttpUrl(
  source: PublicEnvSource,
  key: keyof PublicEnvSource,
): string | undefined {
  const value = optionalString(source, key);
  if (value === undefined) {
    return undefined;
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new EnvValidationError(key, "must be an absolute URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new EnvValidationError(key, "must use http or https");
  }
  return value.replace(/\/+$/, "");
}

function exactBoolean(source: PublicEnvSource, key: "VITE_ENABLE_MODEL_LAB"): boolean {
  const value = source[key];
  if (value === undefined || value === "" || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  throw new EnvValidationError(key, 'must be exactly "true" or "false" when provided');
}

export function parsePublicClientEnv(source: PublicEnvSource): PublicClientEnv {
  return Object.freeze({
    analytics: Object.freeze({
      cfBeaconToken: optionalString(source, "VITE_CF_BEACON_TOKEN"),
      umamiScriptUrl: optionalHttpUrl(source, "VITE_UMAMI_SCRIPT_URL"),
      umamiWebsiteId: optionalString(source, "VITE_UMAMI_WEBSITE_ID"),
    }),
    model: Object.freeze({
      cdnBaseUrl: optionalHttpUrl(source, "VITE_MODEL_CDN_BASE_URL"),
      labEnabled: exactBoolean(source, "VITE_ENABLE_MODEL_LAB"),
      onnxRuntimeWebVersion: "1.27.0" as const,
    }),
  });
}

const client = parsePublicClientEnv({
  VITE_CF_BEACON_TOKEN: import.meta.env.VITE_CF_BEACON_TOKEN,
  VITE_ENABLE_MODEL_LAB: import.meta.env.VITE_ENABLE_MODEL_LAB,
  VITE_MODEL_CDN_BASE_URL: import.meta.env.VITE_MODEL_CDN_BASE_URL,
  VITE_UMAMI_SCRIPT_URL: import.meta.env.VITE_UMAMI_SCRIPT_URL,
  VITE_UMAMI_WEBSITE_ID: import.meta.env.VITE_UMAMI_WEBSITE_ID,
});
const build: BuildEnv = Object.freeze({
  development: import.meta.env.DEV,
  mode: import.meta.env.MODE,
  production: import.meta.env.PROD,
  ssr: import.meta.env.SSR,
});

export const env = Object.freeze({
  build,
  client,
  // Backward-compatible legacy exports during the v2 migration.
  cfBeaconToken: client.analytics.cfBeaconToken,
  modelCdnBaseUrl: client.model.cdnBaseUrl,
  modelLabEnabled: client.model.labEnabled,
  onnxRuntimeWebVersion: client.model.onnxRuntimeWebVersion,
  umamiScriptUrl: client.analytics.umamiScriptUrl,
  umamiWebsiteId: client.analytics.umamiWebsiteId,
});
