const baseUrl = process.env.CAPACITY_BASE_URL ?? "http://127.0.0.1:3000";
const cdnBaseUrl = process.env.CAPACITY_CDN_BASE_URL ?? "https://cdn.cutbg.art/models";
const ssrConcurrency = Number(process.env.CAPACITY_SSR_CONCURRENCY ?? "20");
const modelConcurrency = Number(process.env.CAPACITY_MODEL_CONCURRENCY ?? "4");
const p95BudgetMs = Number(process.env.CAPACITY_P95_BUDGET_MS ?? "2000");
const modelPath =
  "onnx-community/ISNet-ONNX/resolve/3fe6e3db3e32c69aadde61fe388ddb1a0574440c/config.json";

async function timedFetch(url, init) {
  const started = performance.now();
  try {
    const response = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    await response.arrayBuffer();
    return { ok: response.ok, ms: performance.now() - started };
  } catch {
    return { ok: false, ms: performance.now() - started };
  }
}

const ssr = await Promise.all(
  Array.from({ length: ssrConcurrency }, (_, index) =>
    timedFetch(new URL(index % 2 ? "/en" : "/", baseUrl)),
  ),
);
const model = await Promise.all(
  Array.from({ length: modelConcurrency }, () =>
    timedFetch(new URL(modelPath, `${cdnBaseUrl.replace(/\/$/, "")}/`), {
      headers: { Range: "bytes=0-0" },
    }),
  ),
);
const ordered = ssr.map((sample) => sample.ms).sort((left, right) => left - right);
const p95 = ordered[Math.max(0, Math.ceil(ordered.length * 0.95) - 1)] ?? Infinity;
const result = {
  schemaVersion: 1,
  ssr: {
    concurrency: ssrConcurrency,
    failures: ssr.filter((sample) => !sample.ok).length,
    p95Ms: Math.round(p95),
    budgetMs: p95BudgetMs,
  },
  model: {
    concurrency: modelConcurrency,
    failures: model.filter((sample) => !sample.ok).length,
  },
};
console.log(JSON.stringify(result));
if (result.ssr.failures || result.model.failures || p95 > p95BudgetMs) process.exit(1);
