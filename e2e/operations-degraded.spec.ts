import { expect, test } from "@playwright/test";

const CACHED_ASSET =
  "https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json";
const UNCACHED_ASSET =
  "https://cdn.cutbg.art/models/onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/preprocessor_config.json";

test("verified model cache recovers offline and an uncached CDN request fails safely", async ({
  browserName,
  context,
  page,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright service-worker offline instrumentation is Chromium-only",
  );

  await page.goto("/en");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }
  await expect
    .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)), {
      timeout: 15_000,
    })
    .toBe(true);

  const primed = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return {
      status: response.status,
      release: response.headers.get("X-Cutbg-Model-Release"),
    };
  }, CACHED_ASSET);
  expect(primed).toEqual({ status: 200, release: "v0.22.0" });

  await context.setOffline(true);
  try {
    await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
    const offline = await page.evaluate(
      async ({ cached, uncached }) => {
        const cachedResponse = await fetch(cached);
        const uncachedResponse = await fetch(uncached);
        return {
          cachedStatus: cachedResponse.status,
          cachedRelease: cachedResponse.headers.get("X-Cutbg-Model-Release"),
          uncachedStatus: uncachedResponse.status,
          uncachedError: uncachedResponse.headers.get("X-Cutbg-Model-Error"),
        };
      },
      { cached: CACHED_ASSET, uncached: UNCACHED_ASSET },
    );
    expect(offline).toEqual({
      cachedStatus: 200,
      cachedRelease: "v0.22.0",
      uncachedStatus: 503,
      uncachedError: "unavailable",
    });
  } finally {
    await context.setOffline(false);
  }
});
