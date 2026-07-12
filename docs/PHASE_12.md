# PHASE 12 — Localization, Branding & Launch Content

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `12` |
| Title | Localization, Branding & Launch Content |
| Status | `⏳ pending` |
| Tag | `v0.12.0` |
| Depends on | PHASE_11 gate passing |

---

## Phase Goal

Close the launch-readiness gaps SPEC.md §8 left as a one-line stub: the site is currently a single
vertical stack with no header/footer/logo/favicon, no privacy-policy page (a §7.2 requirement never
implemented through Phase 11), no feedback channel, and only one language. This phase ships a
bilingual (`ru`/`en`) site via Paraglide JS (SPEC.md §5.5), a real brand identity ("cutbg" wordmark +
one accent color), a responsive `widgets/tool-workspace` layout replacing the duplicated flat stack
across `pages/home` and the four scenario pages, sitewide header/footer chrome with a Telegram
feedback link, and the missing `/privacy` page. See SPEC.md §5.1, §5.2, §5.5, §6, §7.2, §7.5, §8.

---

## Scope

### Infra
- [x] `I1` Add Paraglide JS toolchain: `project.inlang` config, `messages/ru.json` + `messages/en.json` message catalogs, Vite plugin registration in `vite.config.ts`, generated `src/paraglide/` output — _Depends on:_ —
- [x] `I2` Wire TanStack Router URL localization (`rewrite.input`/`rewrite.output` on `createRouter` using Paraglide's `deLocalizeUrl`/`localizeUrl`) and a server-entry `paraglideMiddleware` passing the original `Request` through, per SPEC.md §5.5 — _Depends on:_ `I1`
- [x] `I3` Configure Paraglide `urlPatterns`: `ru` = base/unprefixed locale (preserves every existing path from §5.1 exactly), `en` = prefixed under `/en/...` — _Depends on:_ `I1`
- [x] `I4` Update `scripts/generate-sitemap.ts` to emit both locale URLs per page with `<xhtml:link rel="alternate" hreflang="...">` entries — _Depends on:_ `I3`

### Frontend
- [x] `F1` `shared/ui/site-header.tsx`: wordmark logo "cutbg" (links home), nav (Home / About), language switcher (via Paraglide `localizeHref`, preserves current page), Telegram feedback link (icon + label, `target="_blank" rel="noopener noreferrer"`, generic lucide icon — no Telegram brand glyph) — _Depends on:_ `I2`, `I3`
- [x] `F2` `shared/ui/site-footer.tsx`: wordmark, short tagline, links (About / Privacy / Telegram feedback), copyright, one-line trust microcopy ("100% client-side · free · private") — _Depends on:_ —
- [x] `F3` `shared/ui/site-shell.tsx`: thin wrapper composing header + page content + footer; each page imports and uses it directly — _Depends on:_ `F1`, `F2`
- [x] `F4` New `widgets/tool-workspace` slice: extracts the upload → quality-toggle → process → preview → background-fill → download composition currently duplicated across `pages/home`, `AvatarPage`, `DocumentPhotoPage`, `ProductPhotoPage`, `LogoPage` (debt flagged in `PHASE_06.md` Implementation Notes) into a responsive grid — single column on mobile/tablet (current stacking order preserved), two-column (`lg:grid-cols-[3fr_2fr]`) on desktop with preview surface left / control rail right and `ProcessingLog` collapsed into a bottom accordion; overall `max-w` increases from `max-w-xl` to `max-w-6xl` — _Depends on:_ —
- [x] `F5` Recolor `--primary`/`--primary-foreground` OKLCH tokens in `globals.css` to one accent hue (currently zero-chroma); rest of the neutral token set unchanged — _Depends on:_ —
- [x] `F6` `pages/home`: compose `site-shell` + a hero/value-prop section (headline, subheadline, 3 feature cards: client-side/private, free/no-account, fast) above `tool-workspace` — _Depends on:_ `F3`, `F4`, `F5`
- [x] `F7` `pages/about`, `pages/product-photo`, `pages/document-photo`, `pages/logo`, `pages/avatar`: compose `site-shell` + `tool-workspace` + a condensed one-line trust badge (not the full hero, to avoid duplicating marketing copy across pages that already require unique SEO copy per §5.1) — _Depends on:_ `F3`, `F4`
- [x] `F8` New `pages/privacy` slice + `/privacy` route: states the "your image never leaves your device" claim, discloses aggregate-only Umami/Cloudflare analytics (no PII, no image content, §7.6), cookie/`localStorage` usage, Telegram contact for privacy questions — _Depends on:_ `F3`
- [x] `F9` Favicon/app-icon set (`favicon.svg` monogram derived from the wordmark in the new accent color, generated `favicon.ico`/`favicon-16x16.png`/`favicon-32x32.png`/`apple-touch-icon.png`), `site.webmanifest` (name/short_name "cutbg", icons, `theme_color`/`background_color`), one shared `og-image.png` (1200×630); wire favicon/manifest/`theme-color` links into `routes/__root.tsx` head — _Depends on:_ `F5`
- [x] `F10` Add OG (`og:title`/`og:description`/`og:image`/`og:type`) + Twitter Card meta, plus `hreflang`/`x-default` alternate `<link>` tags, to every route's `head()` (home, about, 4 scenario pages, privacy, both locales) — _Depends on:_ `F9`, `I3`
- [x] `F11` `/en/...` counterpart routes for home, about, privacy, and the four scenario pages via Paraglide URL localization — English scenario-page slugs decided by the architect 2026-07-12 (see Contracts) — _Depends on:_ `I2`, `I3`, `F6`, `F7`, `F8`
- [x] `F12` Bilingual content: hero/feature-card copy, header/footer nav strings, language-switcher labels, Telegram link labels ("Обратная связь в Telegram" / "Feedback on Telegram"), privacy-policy body copy, and genuinely unique English translations of the four scenario pages' substantive copy (largest content item in this phase — flag for architect review before relying on it for launch, same caution already given to Phase 06's placeholder example images) — _Depends on:_ `F11`

<!-- Test execution is governed by `## Gate Checks` below + docs/STACK.md § Gate Commands.
     Do not duplicate that list here. -->

---

## Files

### Create / modify
~~~
vite.config.ts
project.inlang/settings.json
messages/ru.json
messages/en.json
src/paraglide/                              (generated by Paraglide compiler, gitignored)
src/router.tsx                              (rewrite.input/rewrite.output)
src/server.ts                               ([TODO: verify] exact TanStack Start server-entry
                                             override path/convention for this project's version —
                                             resolve via Context7/find-docs at implementation time,
                                             same as the paraglideMiddleware wiring pattern)
src/routes/__root.tsx                       (favicon/manifest/theme-color meta)
src/routes/index.tsx
src/routes/about.tsx
src/routes/privacy.tsx                      (new)
src/routes/udalit-fon-s-foto-tovara.tsx
src/routes/udalit-fon-s-foto-na-dokumenty.tsx
src/routes/udalit-fon-s-logotipa.tsx
src/routes/udalit-fon-dlya-avatarki.tsx
src/routes/en/index.tsx                     (new)
src/routes/en/about.tsx                     (new)
src/routes/en/privacy.tsx                   (new)
src/routes/en/remove-background-from-product-photo.tsx  (new)
src/routes/en/remove-background-from-id-photo.tsx        (new)
src/routes/en/remove-background-from-logo.tsx             (new)
src/routes/en/remove-background-from-avatar.tsx           (new)
src/pages/home/ui/HomePage.tsx
src/pages/about/ui/AboutPage.tsx
src/pages/product-photo/ui/ProductPhotoPage.tsx
src/pages/document-photo/ui/DocumentPhotoPage.tsx
src/pages/logo/ui/LogoPage.tsx
src/pages/avatar/ui/AvatarPage.tsx
src/pages/privacy/ui/PrivacyPage.tsx        (new)
src/widgets/tool-workspace/                 (new)
src/shared/ui/site-header.tsx               (new)
src/shared/ui/site-footer.tsx               (new)
src/shared/ui/site-shell.tsx                (new)
src/shared/ui/index.ts                      (barrel export update)
src/app/styles/globals.css
scripts/generate-sitemap.ts
public/favicon.svg
public/favicon.ico
public/favicon-16x16.png
public/favicon-32x32.png
public/apple-touch-icon.png
public/site.webmanifest
public/og-image.png
~~~

### Do NOT touch
- `src/features/remove-background`, `features/upload-image`, `features/quality-mode-toggle`, `features/download-result`, `features/correct-mask`, `features/batch-processing`, `features/background-replacement` — this phase is composition/presentation/i18n only, no product-logic changes
- `src/entities/processed-image` — domain types and `BeforeAfterSlider` unchanged
- `src/routes/dev/remove-background.tsx` — dev-only harness, `noindex`, out of scope
- Docker/Nginx/CI infra files — Phase 13's concern, not this phase's

---

## Contracts

> This section is the source of truth for `/context-update`. Fill it in **before** handing to AI.

### New persistent data (tables / collections / files)

None — client-side `localStorage`/Cache Storage contract unchanged (SPEC.md §3).

### New API endpoints / RPC methods / events

| Method | Path | Auth | Response / Payload |
|--------|------|------|---------------------|
| `GET` | `/privacy` | none | SSR HTML: static privacy-policy content (`ru` base locale), per §7.2 |
| `GET` | `/en`, `/en/about`, `/en/privacy` | none | English-locale counterparts of `/`, `/about`, `/privacy` via Paraglide URL localization |
| `GET` | `/en/remove-background-from-product-photo`, `/en/remove-background-from-id-photo`, `/en/remove-background-from-logo`, `/en/remove-background-from-avatar` | none | English-locale counterparts of the four scenario pages. Slugs decided by the architect 2026-07-12, mirroring the `udalit-fon-s-X` → `remove-background-from-X` pattern of the `ru` slugs (`id-photo` over a literal "document-photo" since that's the real English search term for passport/visa photos; `avatar` over "profile-picture" as the closer match to the `ru` meaning) |
| `GET` | `/sitemap.xml` | none | Regenerated to include per-page locale alternates (`<xhtml:link>`), superseding the Phase 06 baseline |

### New types / models / shared interfaces

```ts
// src/paraglide/runtime.js — generated by the Paraglide compiler, not hand-authored
// Locale = "ru" | "en"; "ru" is the base (unprefixed) locale, "en" is served under /en/...
```

No new hand-authored domain types — `site-header`/`site-footer`/`site-shell`/`tool-workspace` are
presentational composition components with no new domain entities.

### New env vars

None — Paraglide is compile-time; no new runtime configuration (consistent with SPEC.md §5.5).

---

## Gate Checks

> **Before running gate:** confirm all Scope checkboxes are checked (or explicitly deferred in
> Architect Review Notes). Unchecked items appear in the gate report as a warning, not a hard block.

Run `/phase-gate 12` before committing.

`/phase-gate` returns full PASS only when:
- Automated checks are green
- All architect review items below are resolved (checked off)

Use the commands in [docs/STACK.md](./STACK.md#gate-commands) as the source of truth for:
- infrastructure / bootstrap
- frontend prep, type-check, unit tests
- e2e — mandatory for this phase's user-facing changes (AGENTS.md core rule 8): add/extend Playwright
  coverage for the language switcher (locale toggle preserves current page), the new desktop
  two-column vs. mobile single-column `tool-workspace` breakpoint, and `/privacy` + `/en/*` rendering
- the default smoke check

```bash
# Phase-specific smoke override
pnpm arch:lint   # steiger — must pass with the new widgets/tool-workspace slice (first use of the
                 # widgets layer; confirm no fsd/* rule needs adjusting beyond the existing
                 # "fsd/insignificant-slice": "off" override in steiger.config.ts)
pnpm build       # must succeed with the Paraglide compile step wired in before `vite build`;
                 # verify public/sitemap.xml includes locale alternates
```

---

## Architect Review Notes

- [x] Processed batch item selected for review must render its preview on the first selection; currently the preview surface appears with a broken image until the item is selected again.
- [x] Rework the batch editing layout so the selected preview sits beside the editing controls at the top of the workspace instead of below the entire image list.
- [x] Translate all user-facing tool UI into Russian on the base locale while preserving complete English copy on `/en/*` routes.
- [x] Redesign the home hero/workspace composition into a more balanced, contemporary minimalist layout: remove the oversized standalone quality section, avoid repetitive feature-card blocks, and center the upload experience.
- [x] Shorten About by removing the technology and author sections; remove the Cookie/localStorage section from Privacy in both locales.
- [x] Redesign the active batch workspace into a clear toolbar → selected-image editor → ordered gallery flow; replace the persistent dropzone with a compact add-images action, and ensure a single added image joins the list without replacing the current editor selection.
- [x] Move batch scheduler/model metadata into the processing toolbar and align add/download-all/clear as one consistent responsive action group with clear visual hierarchy.
- [x] Refine the batch action hierarchy: keep add/download as the two compact workflow actions beside quality, move clear to a quiet trash action in the header, and shorten the ZIP label.

---

## Implementation Notes

- The first-selection broken preview came from creating blob URLs during render with `useMemo`:
  React 19 Strict Mode replays an effect's setup/cleanup on initial mount, so cleanup revoked the
  URL while the remounted effect kept referencing it. `BeforeAfterSlider` now creates, publishes,
  and revokes each URL inside one effect; the batch E2E asserts both preview images have decoded on
  the first selection.
- `F11`/`F12` are now complete. The architect chose the four English scenario slugs on
  2026-07-12 (see Contracts), mirroring the `udalit-fon-s-X` → `remove-background-from-X`
  pattern of the ru slugs (`id-photo` instead of a literal "document-photo" since that's the real
  English search term for passport/visa photos; `avatar` instead of "profile-picture" as the
  closer match to the ru meaning).
- The generic `urlPatterns` entry in `vite.config.ts` (`/:path(.*)?` → `/en/:path(.*)?`) only
  handles same-shaped paths (`/about` ↔ `/en/about`). Since the four scenario slugs are genuinely
  different words per locale, each needed its **own** specific `urlPatterns` entry (`pattern` set
  to the ru/canonical slug, `localized` mapping both locales) placed **before** the generic
  catch-all — confirmed via Paraglide's own docs that specific patterns must precede wildcards or
  they're never reached during localize/delocalize matching. Without this, the language switcher
  (`localizeHref`) and the sitemap generator's `deLocalizeUrl`-based locale grouping would both
  silently produce wrong URLs for the four scenario pages (e.g. `/en/udalit-fon-s-foto-tovara`
  instead of the real `/en/remove-background-from-product-photo`) while every other page kept
  working — a bug that wouldn't have surfaced without deliberately testing the language switcher
  *on a scenario page specifically*, not just on `/about` (added as a new e2e case in
  `e2e/scenario-pages.spec.ts`).
- The four scenario page components (`ProductPhotoPage`, `DocumentPhotoPage`, `LogoPage`,
  `AvatarPage`) previously hardcoded Russian copy directly in JSX, with one stray English
  sentence (originally added as a placeholder subheadline, unintentionally shown on the `ru`
  locale too). All scenario copy — including the "Пример"/"Example" heading — is now driven by
  `messages/{ru,en}.json` keys via `m.*()`, matching the `AboutPage` pattern, so the same
  component correctly serves both the `ru` and `en` route per scenario.
- Accent color: no specific hex was specified anywhere in SPEC.md ("one accent color added to the
  neutral token set"), so `--primary`/`--primary-foreground` were set to a blue-violet
  (`oklch(0.546 0.215 264.376)` light / `oklch(0.623 0.188 264.376)` dark) — the same hue already
  present but unused in `globals.css`'s `--sidebar-primary` token, not an arbitrary new choice. The
  favicon/OG-image accent (`#2D62EB`) is that same color converted to sRGB.
- `widgets/tool-workspace`'s responsive grid uses CSS `grid-template-areas` (new rules in
  `globals.css`) rather than Tailwind utility classes alone, specifically so the mobile/tablet
  column keeps the pre-Phase-12 top-to-bottom order while the `lg:` two-column split rearranges
  the same elements into preview-left/rail-right — plain DOM-order-based grid utilities can't
  satisfy both constraints at once.
- The four scenario pages (`ProductPhotoPage`, `DocumentPhotoPage`, `LogoPage`, `AvatarPage`)
  previously ran a scoped-down copy of the upload/process/download flow without mask-correction
  editing (a debt already flagged in `PHASE_06.md`, since mask correction, Phase 07-09, was only
  ever added to `pages/home`). Extracting one shared `tool-workspace` widget means these four pages
  now also get mask-correction editing — an intentional, in-scope consequence of de-duplicating
  onto a single composition, not scope creep.
- `AboutPage` was English-only pre-Phase-12 (a deliberate Phase-06-era choice, since the whole site
  was English-navigable then). Now that every other page is genuinely bilingual, its ru-locale copy
  was translated to Russian and its `/en/about` counterpart carries the original English text —
  keeping it English-only at the `ru` base locale would have been the one inconsistent page on the
  site.
- Favicon/OG assets were generated with a throwaway script (not committed) that renders HTML via
  Playwright's already-installed Chromium and screenshots it to PNG — no new image-processing
  dependency was added for a one-time asset-generation task.
- `docs/KNOWN_GOTCHAS.md` gained an entry for a `page.mouse.move()`-to-stale-`boundingBox()` e2e
  fragility this phase's grid change exposed in the pre-existing background-replacement color-picker
  test (fixed with `scrollIntoViewIfNeeded()`, not a product bug).

---

## Atomic Commit Message

```
feat(phase-12): i18n, branding, and responsive tool-workspace layout
```

---

## Post-Phase Checklist

- [x] All Scope checkboxes checked (or deferred in Architect Review Notes)
- [x] All automated gate checks green
- [x] All architect review notes resolved
- [x] `docs/STATE.md` updated — run `/context-update 12`
- [ ] Committed atomically on `feat/phase-12` branch
- [ ] Tag created after merge to develop: `git tag -a v0.12.0 -m "Phase 12: Localization, Branding & Launch Content"`
