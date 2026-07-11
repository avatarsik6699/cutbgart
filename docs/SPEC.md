# TECHNICAL SPECIFICATION (SPEC.md): `BG Remove App`

> **For AI agent**: Read this file in full before starting any phase.
> Confirm understanding of constraints and the phased development model.
> When this file changes, run `/spec-sync [description of change]` immediately.

## Metadata

| Field | Value |
|-------|-------|
| Document Version | `v1.1` |
| Date | `2026-07-11` |
| Architect / Owner | `v.godlevskiy` |
| Contract Version | `v1.0` (see `docs/STATE.md` § Current Contract) |
| Stack | See [docs/STACK.md](./STACK.md) |
| Domain | Client-side (in-browser) image background removal. Free, anonymous, no-account tool — ML inference runs entirely on the user's device via WebGPU (WASM fallback), the server never receives or processes the user's image. Domain: `cutbg.art`. |

---

## 1. Project Overview and Goals

### 1.1 Problem

Users who need to remove the background from a photo (product photo, ID/document photo, portrait, logo)
currently have to either install desktop software or upload their image to a third-party server —
which costs the operator inference infrastructure and costs the user privacy (and often money, via
paywalls). There is no free, anonymous, no-account tool where the image provably never leaves the
user's device.

Three invariants govern every decision in this spec (source: architect brief, non-negotiable):

1. **Inference is client-side only.** The server never receives or processes the user's image. This
   is an architectural invariant, not a configuration option — it drives both the privacy story and
   the infrastructure cost model (no GPU servers to run or pay for).
2. **The product is free, with no accounts and no payments.** Donations live separately on a future
   portfolio site and are not technically embedded in this product.
3. **SEO and performance are functional requirements**, not post-launch polish. Every architectural
   decision is checked against "does this hurt indexability or Core Web Vitals?"

### 1.2 Goal and Success Metrics

Goal: ship a free, anonymous, fully client-side background-removal web app that is fast enough to
retain search-driven, one-shot visitors, and that is cheap to operate at scale because it does no
server-side inference.

| Metric | Target |
|--------|--------|
| Image ever leaves the user's device | Never |
| Time to Interactive (TTI), home page | < 2.5 s on average 4G |
| LCP | < 2.5 s |
| INP | < 200 ms |
| Time to first processed result after model load | < 2 s on a WebGPU-capable device, < 8 s on the WASM fallback |
| Infrastructure cost at 50k visits/month | No higher than a single VPS + negligible CDN egress |

Product funnel metrics tracked post-launch (see §7 Observability): model load completion rate,
processing completion rate, download-click conversion, WASM-fallback rate.

### 1.3 Project Boundaries

| Included (MVP) | Excluded |
|-----------------|----------|
| Drag-and-drop / click-to-browse / clipboard-paste image upload | Batch upload of multiple images (backlog v2) |
| JPEG / PNG / WebP input, 20 MB hard limit, client-side downscale above 4096px per side | Point-prompt / SAM-style mask correction (backlog v2+) |
| Single-image processing with cancel/retry | Background replacement (color/image/gradient) (backlog v2) |
| Explicit "fast" vs "max quality" model switch, persisted in `localStorage` | Accounts, processing history, cloud storage of results (backlog v2) |
| Before/after slider result view, PNG-with-alpha download | Public API (backlog v2) |
| WebGPU with automatic, transparent WASM fallback | Mobile app (backlog v2) |
| Explicit error handling for every documented failure mode (§7 NFR) | Any server endpoint that accepts uploaded images (never — architectural invariant) |
| SEO-optimized scenario landing pages (product photo, documents, logo, avatar) | Advertising on this domain (never — product decision) |
| Analytics (Cloudflare Web Analytics + self-hosted Umami, no PII) | Donation/payment on this domain (never — lives on a separate portfolio project) |
| Manual mask correction: brush add/erase/restore directly on the existing `AlphaMatte`, adjustable brush size/hardness, undo/redo | |

---

## 2. Domain Context

### 2.1 Roles and Permissions

There is no account system and no server-side authorization surface. The only "roles" are:

| Role | Capabilities | Restrictions |
|------|-------------|--------------|
| `Visitor` (anonymous, unauthenticated) | Upload one image, choose fast/max-quality mode, run inference client-side, view before/after, download PNG result | No accounts, no persistence of results beyond the browser session, cannot batch-process |
| `AI_Agent` | Implements phases, runs gate checks | No push to main/develop |

### 2.2 Key Entities

These are **client-side runtime entities only** — nothing here is persisted server-side (see §3).

```
DeviceCapabilities → (detected once) informs → QualityMode (default) & InferencePath (WebGPU | WASM)
SourceImage → [features/remove-background] → AlphaMatte → ProcessedImage (composited, downloadable)
QualityMode ("fast" | "max") — user-selectable, persisted client-side in localStorage
```

- **SourceImage** — the user's uploaded file (in-memory only; validated for format/size/resolution,
  downscaled client-side if > 4096px on the longest side).
- **AlphaMatte** — single-channel alpha-matte output of the ML model (not a binary mask — preserves
  soft edges for hair/fur/translucent objects). User-correctable post-inference (Phase 07): brush
  add/erase/restore-to-model-output, adjustable brush size/hardness, undo/redo. Corrections mutate
  the in-memory `AlphaMatte` only — never persisted, never leave the device, consistent with the
  §1.1 privacy invariant.
- **ProcessedImage** — `SourceImage` composited with `AlphaMatte` via `OffscreenCanvas` in the worker;
  exposed to the main thread as a `Blob`/`ImageBitmap`, explicitly released via `URL.revokeObjectURL`
  after download or when a new image is processed.
- **QualityMode** — `"fast"` (default, IS-Net `q8`) or `"max"` (IS-Net `fp32`). Persisted in
  `localStorage`, applied on next visit without re-selection.
- **DeviceCapabilities** — detected once per session (`navigator.gpu.requestAdapter()`); determines
  inference path (WebGPU + `fp16`-capable adapter required, or WASM) and the default `QualityMode`
  for weak devices. WebGPU probing was force-disabled for a period after the originally-shipped
  BiRefNet model proved unusable on WebGPU (onnxruntime-web shader-buffer limit) *and* on WASM fp32
  (`std::bad_alloc`, wasm32 address-space ceiling) — see the model swap to IS-Net below. Re-enabled
  after that swap; confirmed working end-to-end in a real (non-headless) browser, including the
  mid-session `isWebGpuExecutionError` → WASM fallback path in `inference.worker.ts` as a safety net
  if a given device's WebGPU turns out unusable for IS-Net specifically.

---

## 3. Data Model

There is **no server-side persistent data store** — no database, no accounts, no stored images. This
is a direct consequence of the "inference is client-side only, no accounts" invariant (§1.1).

```text
# No server-side entities. All state below is transient, in-memory, and scoped to a single
# browser tab/session, with one exception:

localStorage:
  qualityMode: "fast" | "max"     # persisted across visits, no other user data stored client-side

Cache Storage (Service Worker, public/sw.js) — cache-first, content-hashed, effectively permanent:
  model weights (.onnx files, IS-Net `q8`/`fp32` dtype variants of the same model)
  ONNX Runtime WASM binaries
```

No PII, no image data, no processing history is stored anywhere — client or server.

---

## 4. API / Backend Contract

**Architectural invariant: no API endpoint anywhere in this system accepts an uploaded image.** The
absence of such a route is deliberate — it eliminates an entire class of risk (malicious file
uploads, storage of sensitive data) by construction, not by validation.

The only server-side component is TanStack Start's Nitro SSR server, and its sole job is to render
static/marketing page shells:

| Verb / Method | Path / Topic | Auth | Response / Payload |
|---------------|--------------|------|---------------------|
| `GET` | `/` and all routes in §5.1 | none | SSR HTML: `<title>`, `<meta description>`, `<link rel="canonical">`, JSON-LD, hydrates client bundle. No image or user data in the request or response. |
| `GET` | `/sitemap.xml` | none | Generated at build time by `scripts/generate-sitemap.ts` from the `routes/` tree |
| `GET` | `/robots.txt` | none | Static, fully open, links to `sitemap.xml` |

All model weights and WASM binaries are served from Cloudflare R2 via CDN URL (content-hashed path),
not from the app's own Nitro server — see §6.

Umami's own `/api/heartbeat` (used by uptime monitoring, §7 Observability) belongs to the Umami
container, not to this app's contract.

---

## 5. Frontend / Client Contract

> No design assets (Figma) were provided for this cycle — this section is derived from the
> architect's written brief (`raw_spec.md` §5–§7), which specifies layout, composition, and state
> machine in enough structural detail to plan phases from. Revisit if screenshots become available.

### 5.1 Pages (MVP)

| Surface | Purpose | Notes |
|---------|---------|-------|
| `/` | Home — generic tool, targets broad queries | Required |
| `/udalit-fon-s-foto-tovara` | Product photo / marketplace listings scenario | Required |
| `/udalit-fon-s-foto-na-dokumenty` | ID/document photo scenario | Required |
| `/udalit-fon-s-logotipa` | Logo scenario | Desired |
| `/udalit-fon-dlya-avatarki` | Avatar/social profile photo scenario | Desired |
| `/about` | About the project, tech, author link | Does not block launch |

Every scenario page requires unique, substantive body copy (not keyword-shuffled) and at least one
scenario-relevant before/after example — thin/duplicate content risks search-engine penalties.

### 5.2 Components / Feature Slices (Feature-Sliced Design, see §6)

| Slice | Layer | Responsibility |
|-------|-------|-----------------|
| `pages/home`, `pages/product-photo`, ... | `pages` | Compose features + entities per scenario page; own zero business logic (that lives in `features`/`entities`) |
| `features/upload-image` | `features` | Drag-and-drop (full working area), click-to-browse, clipboard paste, mobile camera capture; format/size/resolution validation; client-side downscale |
| `features/remove-background` | `features` | Web Worker model init + inference, WebGPU/WASM device detection, `useBackgroundRemoval` hook exposing the state machine (§5.3), `OffscreenCanvas` postprocessing/compositing |
| `features/quality-mode-toggle` | `features` | Fast/max-quality UI control, reads/writes `localStorage`, passed into `remove-background` as a parameter (not hardcoded) |
| `features/download-result` | `features` | PNG-with-alpha download button |
| `features/correct-mask` | `features` | Brush-based add/erase/restore editing of the current `AlphaMatte`; adjustable brush size/hardness; undo/redo history; re-composites via the existing `OffscreenCanvas` pipeline in `features/remove-background` — no new inference pass |
| `entities/processed-image` | `entities` | Domain type (source + result + metadata) and the `BeforeAfterSlider` display component |
| `shared/ui` | `shared` | shadcn/ui components (Base UI engine), copied into the repo, not an npm black box |

Routing note: `routes/*.tsx` (TanStack Router file-based routing) stays a thin `loader` + head-meta +
render shell; all composition and business logic lives in `pages/*`, per §5.5 of the architect's
brief. Cross-layer imports must go through each slice's public API (`index.ts`) — enforced by Steiger
(`fsd/no-public-api-sidestep`), see §7.

### 5.3 UI State Machine

Implemented explicitly as a state machine, not scattered boolean flags:

```
idle → model-loading → ready → processing → result ⇄ correcting
                ↓            ↓         ↓
              error        error     error
```

- **idle** — drag-and-drop zone shown, nothing loaded, model not initialized. Quality-mode toggle is
  visible and selectable here (before file selection).
- **model-loading** — user selected a file; model weights are downloading. Progress bar reflects real
  download/build/ready callbacks from Transformers.js v4 — never a simulated/fake progress bar.
- **ready** — model loaded and cached; inference not yet started. On repeat processing within the
  same session this state is reached instantly (model stays warm).
- **processing** — inference running in the Web Worker; WASM fallback path explicitly labeled as
  "lightweight mode" in the UI.
- **result** — before/after slider, download button, "process another image" (resets state without a
  page reload; model stays in memory/cache), a one-click "recompute in max quality" action, and an
  "edit mask" entry point into **correcting**.
- **correcting** — user brushes corrections (add/erase/restore-to-model-output) onto the current
  `AlphaMatte`; adjustable brush size/hardness; undo/redo. Does not re-run inference — only
  re-composites via the existing `OffscreenCanvas` pipeline. "Done" returns to **result** with the
  corrected composite; corrections are never persisted beyond the in-memory session.
- **error** — reachable from any state; always carries a concrete message and an action (retry/reset),
  never a bare "something went wrong."

### 5.4 Accessibility & Mobile

- Drag-and-drop zone is keyboard-accessible via a real `<input type="file">` underneath — not a
  visual-only drop target.
- `aria-live="polite"` region announces state transitions (loading/ready/error) for screen readers.
- WCAG AA contrast and focus states on all interactive elements.
- Mobile: drag-and-drop is replaced by an explicit "choose photo" button with camera access
  (`capture` attribute) — a distinct "photograph right now" use case, supported explicitly.

---

## 6. Infrastructure

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | TanStack Start v1.x (on TanStack Router) | Chosen over Next.js per architect requirement; Nitro output is a portable Node bundle, no Vercel lock-in |
| Server runtime | Nitro, `node-server` preset | Produces the Docker-deployable Node bundle |
| Language | TypeScript, strict mode | Mandatory |
| UI | React 19, Tailwind CSS, shadcn/ui on Base UI | Base UI became shadcn/ui's default primitive layer (replacing Radix) as of July 2026; components are copied into the repo, not installed as a black-box dependency |
| Architecture | Feature-Sliced Design (flexible mode): `app / pages / features / entities / shared` | `processes` and `widgets` deliberately omitted — `processes` is officially excluded from FSD, and `widgets` would add abstraction with no payoff at this project's size (composition lives in `pages`) |
| ML inference | `@huggingface/transformers` (Transformers.js) v4, ONNX Runtime Web | WebGPU execution provider with automatic WASM fallback (`isWebGpuExecutionError` mid-session catch in `inference.worker.ts`); runs inside a Web Worker, never the main thread |
| Model | `onnx-community/ISNet-ONNX`, one model for both quality tiers, differentiated by dtype: `q8` (fast/default), `fp32` (max quality) | Replaces the originally-shipped BiRefNet (`onnx-community/BiRefNet_lite-ONNX` / `BiRefNet-ONNX`), which turned out unusable on both WebGPU (onnxruntime-web storage-buffer shader limit, microsoft/onnxruntime#21968) and WASM (`std::bad_alloc` under the fp32 model's memory footprint) — confirmed via real-browser reproduction, not just the headless-e2e gap noted in Phase 04. AGPL-3.0-licensed; accepted knowingly for this non-commercial project (architect decision) — revisit before any commercial use |
| Package manager | pnpm | |
| Containers | Docker + docker-compose: `nginx`, `app` (Node/Nitro SSR), `umami` + `umami-db` (Postgres) | Each service `restart: unless-stopped`; Node container runs with `init: true` (tini as PID 1); `umami-db` has a persistent volume + healthcheck gating `umami` startup |
| Reverse proxy / TLS | Nginx; Certbot (cron) or `nginx-proxy` + `acme-companion` | Gzip/Brotli for SSR text responses |
| CDN / model weight storage | Cloudflare (proxy) + Cloudflare R2 | Model `.onnx` files and ONNX Runtime WASM binaries are **not** in the app Docker image — served from R2 via CDN with a content hash in the path, `Cache-Control: public, max-age=31536000, immutable` |
| VPS | hip-hosting, 1-2 vCPU / 1-2 GB RAM | Server only does SSR of a light page shell (no inference); Umami+Postgres is the component most likely to grow with traffic; scale by upgrading the same provider's tier — no architecture migration needed since the whole stack is Docker Compose |
| CI/CD | GitHub Actions | On push to `main`: lint → tests → build Docker image → push to GitHub Container Registry → SSH `docker compose pull && docker compose up -d` on the VPS. A separate workflow uploads model weights to R2 only when weights change, not on every code deploy. |

### 6.1 Model loading & caching (client-side)

- Model is **not** fetched on component mount — only on the user's first explicit upload action
  (protects LCP/TTI).
- `env.useWasmCache = true` is mandatory (otherwise ONNX runtime files re-download every visit).
- A dedicated Service Worker (`public/sw.js`) cache-first caches model weight files and WASM binaries,
  versioned by content hash in the path.
- `q8` dtype for `"fast"` (~44 MB, library default for CPU inference), `fp32` for `"max"` (~176 MB,
  full precision) — both served from the same `onnx-community/ISNet-ONNX` repo.
- The two dtype variants cache independently — toggling quality mode mid-session does not re-download
  an already-cached variant.

---

## 7. Non-Functional Requirements

### 7.1 Performance

See §1.2 for the numeric targets (TTI, LCP, INP, time-to-first-result). Large images (> 4096px on the
longest side) are downscaled client-side before inference; the output mask is upscaled back to the
original resolution before final PNG compositing, to avoid degrading the source image's quality.

### 7.2 Security & Privacy

- No server endpoint anywhere accepts image files — see §4 (architectural invariant, not a
  configuration/validation choice).
- CSP headers: scripts/WASM loadable only from the app's own domain and the CDN/R2 domain; no inline
  scripts without a nonce.
- Model weights are intentionally public (open-source weights) — no need to gate access to them.
- A static privacy-policy page must explicitly and accurately state "your image never leaves your
  device" — this is the product's core claim and must remain verifiably true, not marketing copy.

### 7.3 Error Handling (mandatory, one explicit path per case)

| Failure | Required behavior |
|---------|--------------------|
| WebGPU unavailable | Automatic, user-transparent fallback to WASM, with a light notice: "running in lightweight mode, will be a bit slower" |
| File exceeds size/resolution limit | Clear error stating the exact limit |
| Unsupported file format | Clear error |
| Model load failure (no network on first visit, CDN 404/CORS) | Retry with a "try again" button |
| Device out-of-memory during inference | Caught explicitly; clear message suggesting a lower resolution |

### 7.4 Cross-Browser Support Matrix (mandatory test coverage)

| Browser/device | Inference path | Test priority |
|-----------------|-----------------|----------------|
| Chrome/Edge desktop | WebGPU + `fp16` | High |
| Safari desktop/iOS (limited WebGPU support) | WASM + `q8` fallback | High — requires testing on a real device, not just emulation |
| Android Chrome | WebGPU (chipset-dependent) with fallback | Medium |
| Older/low-power devices | WASM, expect degraded time | Medium — UI must never hang |

### 7.5 SEO

- Full SSR HTML per route with correct `<title>`, `<meta description>`, `<link rel="canonical">` via
  the TanStack Router loader/head API.
- JSON-LD: `WebApplication` on the home page, `HowTo` on scenario pages.
- Unique `<h1>` per page containing the target scenario phrase.
- Example images: WebP/AVIF, `loading="lazy"`, below the fold.
- `scripts/generate-sitemap.ts` runs at build/CI time, walking the `routes/` tree — prevents a new
  scenario page from being forgotten in the sitemap.
- `robots.txt` fully open, links to `sitemap.xml`.

### 7.6 Observability

| Signal | Source | Purpose |
|--------|--------|---------|
| Visits, geography, device, real-user Core Web Vitals | Cloudflare Web Analytics | Zero-config traffic/perf overview |
| `model_load_started` / `_completed` / `_failed` | Umami custom event | Model-load drop-off rate |
| `processing_started` / `_completed` / `_failed` | Umami custom event | Core product completion metric |
| `download_clicked` | Umami custom event | Funnel's final conversion |
| `webgpu_unavailable_fallback` | Umami custom event | Frequency of WASM fallback — prioritization signal |
| Uptime | Uptime Kuma (self-hosted) or UptimeRobot free tier | Ping home page + Umami `/api/heartbeat` every 5 min, alert via Telegram/email |
| Logs | Nginx access/error → container stdout, size-bounded rotation via the `docker-compose` log driver | No separate log aggregator at this scale |

All analytics events are aggregate counters only — no PII, no linkage to a specific image or its
content (consistent with the privacy invariant in §1.1/§7.2).

### 7.7 Testing

| Type | Coverage | Tool |
|------|----------|------|
| Unit | `features/remove-background` — device-capability detection, error handling, pure postprocessing functions | Vitest |
| Architecture | FSD layer boundaries, slice public-API enforcement, no same-layer cross-imports | Steiger (separate CI step, before tests) |
| Integration | `useBackgroundRemoval` hook against a mocked worker | Vitest + Testing Library |
| E2E (critical path) | Upload → process → download, on a real (or headless WebGPU-flagged) browser | Playwright |
| E2E (mask correction) | Enter **correcting** → brush add/erase/restore → undo/redo → "done" → download reflects the corrected composite | Playwright |
| Cross-browser matrix | WebGPU path and WASM fallback separately, must include Safari/iOS | Playwright projects per browser |
| Visual regression (optional, v2) | UI components across states | Playwright screenshots |

Priority: critical-path E2E and the cross-browser matrix outrank unit coverage percentage — the cost
of "broken on Safari" or "hangs on a weak Android device" is higher than the cost of a gap in a small
utility function's unit tests.

---

## 8. Phased Delivery Plan

| Phase | Title | Goal | Key Outputs |
|-------|-------|------|-------------|
| `01` | Scaffold | Working infrastructure chain end-to-end before any product logic | TanStack Start project with FSD layers, ESLint flat config + Prettier + Steiger + Husky/lint-staged wired up; Docker + Nginx + VPS deploy of a "hello world" page |
| `02` | ML core | Background-removal ML pipeline works in isolation | `features/remove-background` slice on an undesigned test page: both models (lite + full) load, WebGPU/WASM detection, inference, the full state machine (§5.3) and error handling (§7.3) |
| `03` | Quality toggle & design system | User-facing quality control + component foundation | `features/quality-mode-toggle`; shadcn/ui on Base UI installed and configured; base `shared/ui` component set |
| `04` | Home page UI | Full product experience on the primary page | `pages/home` composing upload + quality toggle + ML core + result view; all §5.3 states wired to UI; accessibility (§5.4) |
| `05` | Analytics | Funnel visibility | Umami + Cloudflare Web Analytics wired; all events from §7.6 firing |
| `06` | SEO layer | Search-driven acquisition | Scenario pages (§5.1) as new `pages/*` slices reusing existing features; sitemap generation; structured data; meta tags |
| `07` | Manual mask correction | Post-inference precision control — the tool is not usable end-to-end without a way to fix model mistakes on real photos | `features/correct-mask` slice: brush add/erase/restore on the current `AlphaMatte`, adjustable brush size/hardness, undo/redo; new `correcting` state (§5.3) wired into `pages/home`; e2e coverage (§7.7) |
| `08` | Hardening & Launch | Confidence across the real device matrix, then public availability | Full pass over §7.4 matrix on real devices, not just emulators; polish; production publish — explicitly not blocked on the separate portfolio/donation track |

---

## 9. Out of Scope

**Backlog v2+ (deliberately deferred, not rejected):**
- Batch processing of multiple images
- Point-prompt / SAM-style mask correction (click positive/negative regions; heavier model, distinct
  from the brush-based correction pulled into MVP as Phase 07)
- Background replacement (color/image/gradient)
- Accounts, processing history, cloud storage of results
- Public API
- Mobile app

**Never (product decision, not a phasing choice):**
- Any server endpoint that accepts uploaded images, in any form
- Advertising on this domain
- Donations/payments on this domain (lives on a separate portfolio project)

---

## 10. Open Questions

- Exact list of SEO scenario pages for launch beyond the four already specified (§5.1) — needs
  validation against actual Russian-language long-tail search volume before scenario copy is written.
- Final list of shadcn/ui components to copy into `shared/ui` for MVP (minimum known so far: button,
  slider, toast/notification, dialog for mobile menu if needed).
