import { describe, expect, it } from "vitest";

import { EnvValidationError, env, parsePublicClientEnv } from "./env";

describe("public client env", () => {
  it("normalizes public URLs and preserves backward-compatible values", () => {
    const parsed = parsePublicClientEnv({
      VITE_MODEL_CDN_BASE_URL: "https://cdn.example.test/models///",
      VITE_ENABLE_MODEL_LAB: "true",
      VITE_UMAMI_SCRIPT_URL: "https://analytics.example.test/script.js",
      VITE_UMAMI_WEBSITE_ID: " site-1 ",
      VITE_CF_BEACON_TOKEN: " token-1 ",
    });

    expect(parsed).toEqual({
      analytics: {
        cfBeaconToken: "token-1",
        umamiScriptUrl: "https://analytics.example.test/script.js",
        umamiWebsiteId: "site-1",
      },
      model: {
        cdnBaseUrl: "https://cdn.example.test/models",
        labEnabled: true,
        onnxRuntimeWebVersion: "1.27.0",
      },
    });
  });

  it("keeps absent optional values undefined and the lab disabled", () => {
    expect(parsePublicClientEnv({})).toMatchObject({
      analytics: {
        cfBeaconToken: undefined,
        umamiScriptUrl: undefined,
        umamiWebsiteId: undefined,
      },
      model: { cdnBaseUrl: undefined, labEnabled: false },
    });
  });

  it.each([
    ["VITE_MODEL_CDN_BASE_URL", "relative/path"],
    ["VITE_UMAMI_SCRIPT_URL", "file:///tmp/script.js"],
    ["VITE_ENABLE_MODEL_LAB", "TRUE"],
    ["VITE_UMAMI_WEBSITE_ID", 42],
  ] as const)("rejects invalid %s", (key, value) => {
    expect(() => parsePublicClientEnv({ [key]: value })).toThrowError(EnvValidationError);
  });

  it("does not expose non-VITE server values through the parser result", () => {
    const source = {
      VITE_ENABLE_MODEL_LAB: "false",
      UMAMI_APP_SECRET: "must-not-leak",
      POSTGRES_PASSWORD: "must-not-leak",
    };
    const serialized = JSON.stringify(parsePublicClientEnv(source));

    expect(serialized).not.toContain("must-not-leak");
    expect(serialized).not.toContain("SECRET");
    expect(serialized).not.toContain("PASSWORD");
  });

  it("keeps legacy flat exports identical to the typed client namespace", () => {
    expect(env.modelCdnBaseUrl).toBe(env.client.model.cdnBaseUrl);
    expect(env.modelLabEnabled).toBe(env.client.model.labEnabled);
    expect(env.onnxRuntimeWebVersion).toBe(env.client.model.onnxRuntimeWebVersion);
    expect(env.umamiScriptUrl).toBe(env.client.analytics.umamiScriptUrl);
    expect(env.umamiWebsiteId).toBe(env.client.analytics.umamiWebsiteId);
    expect(env.cfBeaconToken).toBe(env.client.analytics.cfBeaconToken);
  });
});
