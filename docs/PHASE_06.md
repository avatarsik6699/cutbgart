# PHASE 06 — SEO layer

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `06` |
| Title | SEO layer |
| Status | `⏳ pending` |
| Tag | `v0.06.0` |
| Depends on | PHASE_05 gate passing |

---

## Phase Goal

Search-driven acquisition: add the scenario pages from SPEC.md §5.1 as new `pages/*` slices that
reuse the existing upload/quality/remove-background/download features (no new product logic), each
with unique substantive copy, a scenario-relevant before/after example, correct SSR head metadata,
and JSON-LD structured data (SPEC.md §7.5). Add sitemap generation and `robots.txt` so nothing new
gets forgotten in search-engine discovery.

---

## Scope

### Frontend
- [ ] `F1` `pages/product-photo` slice — `/udalit-fon-s-foto-tovara` (product photo / marketplace
  listing scenario, required), composing the existing upload + quality-toggle + remove-background +
  download features with scenario-specific `<h1>`/body copy and at least one before/after example
  image (SPEC.md §5.1) — _Depends on:_ —
- [ ] `F2` `pages/document-photo` slice — `/udalit-fon-s-foto-na-dokumenty` (ID/document photo
  scenario, required), same composition pattern as `F1` — _Depends on:_ —
- [ ] `F3` `pages/logo` slice — `/udalit-fon-s-logotipa` (logo scenario, desired) — _Depends on:_ —
- [ ] `F4` `pages/avatar` slice — `/udalit-fon-dlya-avatarki` (avatar/social profile scenario,
  desired) — _Depends on:_ —
- [ ] `F5` `pages/about` slice — `/about` (project/tech/author info, does not block launch) —
  _Depends on:_ —
- [ ] `F6` `routes/*.tsx` thin loader + head shells for `F1`–`F5`, each setting `<title>`,
  `<meta description>`, `<link rel="canonical">` via the TanStack Router head API (SPEC.md §7.5) —
  _Depends on:_ `F1`, `F2`, `F3`, `F4`, `F5`
- [ ] `F7` JSON-LD structured data: `WebApplication` schema added to the existing home page,
  `HowTo` schema added to each scenario page (`F1`–`F4`) (SPEC.md §7.5) — _Depends on:_ `F6`
- [ ] `F8` Unique `<h1>` per page containing its target scenario phrase; example images as
  WebP/AVIF, `loading="lazy"`, placed below the fold (SPEC.md §7.5) — _Depends on:_ `F1`, `F2`,
  `F3`, `F4`

### Infra
- [ ] `I1` `scripts/generate-sitemap.ts` — walks the `routes/` tree at build/CI time, emits
  `/sitemap.xml` (SPEC.md §4, §7.5) — _Depends on:_ `F6`
- [ ] `I2` `public/robots.txt` — fully open, links to `sitemap.xml` (SPEC.md §4, §7.5) —
  _Depends on:_ `I1`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
src/routes/udalit-fon-s-foto-tovara.tsx
src/routes/udalit-fon-s-foto-na-dokumenty.tsx
src/routes/udalit-fon-s-logotipa.tsx
src/routes/udalit-fon-dlya-avatarki.tsx
src/routes/about.tsx
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/product-photo/index.ts
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/document-photo/index.ts
src/pages/logo/ui/LogoPage.tsx
src/pages/logo/index.ts
src/pages/avatar/ui/AvatarPage.tsx
src/pages/avatar/index.ts
src/pages/about/ui/AboutPage.tsx
src/pages/about/index.ts
src/shared/lib/seo/json-ld.ts
src/shared/lib/seo/index.ts
scripts/generate-sitemap.ts
public/robots.txt
public/images/ (new scenario before/after example assets, WebP/AVIF)
docs/STACK.md
~~~

### Do NOT touch
- `features/upload-image`, `features/remove-background`, `features/quality-mode-toggle`,
  `features/download-result`, `entities/processed-image` — reused as-is; this phase is composition
  and copy, not new product logic
- `src/pages/home`, `src/routes/index.tsx` — already complete (Phase 04); only gains the
  `WebApplication` JSON-LD block (`F7`), nothing else changes
- ML pipeline / worker (`features/remove-background/worker`), `shared/lib/analytics` — untouched,
  out of scope

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — no server-side persistent store in this project (SPEC.md §3).

### New API endpoints / RPC methods / events

| Method | Path | Auth | Response / Payload |
|--------|------|------|---------------------|
| `GET` | `/udalit-fon-s-foto-tovara`, `/udalit-fon-s-foto-na-dokumenty`, `/udalit-fon-s-logotipa`, `/udalit-fon-dlya-avatarki`, `/about` | none | SSR HTML: `<title>`, `<meta description>`, `<link rel="canonical">`, JSON-LD, hydrates client bundle. No image or user data in the request or response (SPEC.md §4) |
| `GET` | `/sitemap.xml` | none | Generated at build time by `scripts/generate-sitemap.ts` from the `routes/` tree (SPEC.md §4) |
| `GET` | `/robots.txt` | none | Static, fully open, links to `sitemap.xml` (SPEC.md §4) |

### New types / models / shared interfaces

None — SPEC.md does not specify a concrete shared interface for this phase; JSON-LD payloads are
plain per-page objects passed to the head API, not a reusable domain type.

### New env vars

None

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 06` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- migrations (if applicable)
- backend / unit tests
- frontend prep, type-check, unit tests (if a frontend exists)
- e2e — mandatory for any phase that adds/changes a user-facing flow (AGENTS.md core rule 8): this
  phase adds five new routes, so add a Playwright spec (e.g. `e2e/scenario-pages.spec.ts`) covering,
  per page: renders its `<h1>`/upload control, and the critical upload→process→download path stays
  reachable through the reused features — not just `n/a`
- the default smoke check

If this phase needs a custom smoke target or other phase-specific note, record it here:

```bash
# Optional phase-specific smoke override
docker compose exec -T app node -e "fetch('http://localhost:3000/sitemap.xml').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
docker compose exec -T app node -e "fetch('http://localhost:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
```

---

## Architect Review Notes

Use this section after manual product, UX, API, or workflow verification. This is the human-facing
channel for post-implementation fixes.

Add one unchecked checkbox per issue the agent must fix before the phase can close. Keep each item
independently fixable and describe observed behavior plus expected behavior. If the fix may change
SPEC/API/schema/security behavior, say so explicitly in the note.

The agent resolves these items through `/impl-assist 06 review`. Leave an item unchecked while it
is still open. Check it off only after the fix is implemented and re-verified. If manual
verification found nothing, keep the default checked line below.

- [x] No architect review issues recorded

---

## Implementation Notes

<!-- Optional. The agent adds a short bullet here only when something isn't already visible from
     the code or commit history: an intentional deviation from the plan, a residual risk, a
     rejected alternative. Leave empty when nothing needs recording — this is not a mandatory
     per-task log. -->

None

---

## Atomic Commit Message

```
feat(phase-06): SEO layer — scenario pages, sitemap, structured data
```

---

## Post-Phase Checklist

- [ ] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [ ] All automated gate checks green
- [ ] All architect review notes resolved
- [ ] `docs/STATE.md` updated — run `/context-update 06`
- [ ] Committed atomically on `feat/phase-06` branch
- [ ] Tag created after merge to develop: `git tag -a v0.06.0 -m "Phase 06: SEO layer"`
