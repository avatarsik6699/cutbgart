# PHASE 34 — Final Legal, Consent & Release Readiness

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `34` |
| Title | Final Legal, Consent & Release Readiness |
| Status | `⏳ pending` |
| Tag | `v0.34.0` |
| Depends on | PHASE_33 gate passing; Phase-24 audit retained as the baseline input |

---

> ⚠️ **NEEDS_REVIEW** — Spec changed on 2026-08-01.
> This legal/release contract depends on the superseded legacy roadmap. Preserve it as future input,
> but renumber and re-scope it only after Phase 33 v2 evidence.

## Phase Goal

After the product functionality and validation are complete, refresh the Phase-24 legal/data audit
against the actual final application and current provider configuration, obtain a new explicit
approval, then implement that final transparency, legal-page, footer, and privacy-choice contract.
Behavior must match the refreshed data inventory, keep the editor usable after refusal, avoid dark
patterns and false compliance/cookie claims, and introduce no future metadata merely because
governance is ready (SPEC.md §3, §5.1–§5.2, §5.4–§5.5, §7.2, §7.5–§7.8, §8).

---

## Scope

### Final legal/data refresh

- [ ] `L1` Re-inspect the Phase-33 product and deployed provider configuration. Refresh
  `DATA_INVENTORY.md`, `PROPOSED_METADATA.md`, the storage/request evidence, processor/transfer
  register, retention/deletion rules, localization/notification duties, and rights/security
  procedures. Explicitly cover all storage, editor/export behavior and Phase-32 runtime/error state,
  analytics requests, logs, support paths, and providers added or changed since Phase 24 —
  _Depends on:_ —
- [ ] `L2` Re-evaluate jurisdiction, target-market, minors, controller identity/contact, legal
  bases, route/footer requirements, consent/storage choices, translations, terms/offer needs, and
  every draft against the refreshed facts. Update `APPLICABILITY_MATRIX.md`,
  `IMPLEMENTATION_MATRIX.md`, and the versioned RU/EN drafts; unresolved facts remain visible
  blockers and are never invented — _Depends on:_ `L1`
- [ ] `L3` Record a new dated approval of the final implementation matrix and texts. Qualified
  legal review is recommended; if the owner proceeds without it, record a new explicit residual-
  risk acceptance that names the final-product evidence and must not be presented as legal review
  or universal compliance — _Depends on:_ `L2`

### Frontend

- [ ] `F1` Add a versioned legal-content manifest and render the re-approved bilingual final route
  set: revised `/privacy`, `/terms`, `/cookies`, English counterparts, and only conditional
  operator/consent routes listed in the implementation matrix. Include effective date, operator,
  contact, purposes/data/recipients/location/retention/rights, and change navigation exactly where
  approved — _Depends on:_ `L3`
- [ ] `F2` Update the shared footer in both locales with the approved operator/contact disclosure
  and links to Privacy, Terms, Cookie & storage notice, and `Privacy choices` when applicable.
  Links are usable on every public/scenario/legal page and do not crowd the primary editor action —
  _Depends on:_ `F1`
- [ ] `F3` Implement `features/privacy-choices` only to the extent required by the matrix. The
  first layer gives equally clear Accept/Reject and Settings for non-essential categories; no
  preselection, scroll-to-consent, cookie wall, or manipulative hierarchy. If no banner is legally
  required, render the approved notice/settings path without manufacturing consent — _Depends on:_
  `F1`
- [ ] `F4` Gate each non-essential integration/storage operation before its script/request/write,
  including the matrix's decision for Cloudflare Web Analytics and Umami. Necessary
  quality/editor/model-cache functionality remains available and documented; rejection never blocks
  upload/edit/download — _Depends on:_ `F3`
- [ ] `F5` Store only the approved minimal, versioned choice evidence with no random/user ID.
  Apply the reviewed expiry/re-prompt rule, migrate invalid/old versions safely, and expose an
  always-available footer control to change or withdraw as easily as acceptance — _Depends on:_
  `F3`, `F4`
- [ ] `F6` Keep any separate personal-data consent independent from Terms and other confirmations
  when required by the matrix. Do not request consent where another approved legal basis applies
  and do not add a form or metadata field that the final matrix did not approve — _Depends on:_
  `F1`, `F3`
- [ ] `F7` Add accessible dialog/banner/settings focus management, keyboard operation, screen-reader
  labels/status, no motion dependency, responsive layout, and SSR-readable legal content. Add
  canonical/hreflang/sitemap/meta policy from the approved manifest without making thin pages —
  _Depends on:_ `F1`–`F6`
- [ ] `F8` Add unit/component tests for manifest/versioning, gating-before-choice, accept/reject/
  granular/change/withdraw, no-ID evidence, invalid/expired state, analytics disabled/enabled
  branches, core-service availability, footer/routes/locales, and accessible interactions —
  _Depends on:_ `F1`–`F7`
- [ ] `F9` Add bilingual configured-Chromium Playwright request/storage inspection: before choice, after
  Reject, Accept, granular settings, withdrawal, and notice-version change. Assert only approved
  cookies/storage/analytics requests occur and complete single plus multiple-upload edit/download
  flows after rejection — _Depends on:_ `F8`

### Infra

- [ ] `I1` Align CSP/script loading and deployment configuration with the approved gating strategy.
  Add no CMP/third-party tracker/package unless the refreshed final matrix explicitly approves it
  and its license, payload, processor, retention, and loading behavior are documented in
  `docs/STACK.md` — _Depends on:_ `F9`

### Release readiness

- [ ] `R1` Produce `docs/audits/PHASE_34_RELEASE_READINESS.md` linking the Phase-33 product evidence,
  refreshed legal/data evidence, final approval, implemented matrix, tests, known limitations and
  owner-accepted residual risks. Final readiness cannot be marked PASS while a mandatory fact,
  P0/P1, non-essential pre-choice request, publication blocker or unapproved claim remains —
  _Depends on:_ `L3`, `I1`

---

## Files

### Create / modify

~~~
src/shared/config/legal-content.ts
src/pages/privacy/
src/pages/terms/
src/pages/cookies/
src/routes/privacy.tsx
src/routes/terms.tsx
src/routes/cookies.tsx
src/routes/en/privacy.tsx
src/routes/en/terms.tsx
src/routes/en/cookies.tsx
src/features/privacy-choices/model/types.ts
src/features/privacy-choices/model/privacy-choices.ts
src/features/privacy-choices/model/*.test.ts
src/features/privacy-choices/ui/PrivacyNotice.tsx
src/features/privacy-choices/ui/PrivacySettings.tsx
src/features/privacy-choices/ui/*.test.tsx
src/features/privacy-choices/index.ts
src/routes/__root.tsx
src/shared/lib/analytics/
src/shared/ui/site-footer/
scripts/generate-sitemap.ts
messages/ru.json
messages/en.json
e2e/privacy-legal.spec.ts
docs/audits/PHASE_34_RELEASE_READINESS.md
docs/legal/
docs/STACK.md
docs/PHASE_34.md
~~~

Conditional routes/files from the re-approved final manifest are added surgically; unapproved
placeholder pages are not created.

### Do NOT touch

- Add server metadata storage, database/API, account, contact form, advertising, or payments
- Change image-local processing or send image/image-derived bytes to analytics
- Add legal claims, processors, categories, routes, consent purposes, or retention beyond the
  refreshed and re-approved final matrix

---

## Contracts

### New persistent data (tables / collections / files)

Only if the refreshed final matrix requires a stored privacy choice:

```text
localStorage.privacyChoices = {
  schemaVersion: 1,
  noticeVersion: string,
  decidedAt: ISO-8601 string,
  expiresAt: ISO-8601 string | null,
  choices: { analytics: boolean }
}
```

The final categories and expiry come verbatim from the approved matrix. No unique visitor ID,
fingerprint, image/filename, interaction history, or server-side consent profile is added.

### New API endpoints / RPC methods / events

SSR `GET` routes for the approved bilingual legal-page manifest only. No data-submission endpoint
or analytics event is added.

### New types / models / shared interfaces

```ts
type PrivacyCategory = "necessary" | "analytics";

interface PrivacyChoices {
  schemaVersion: 1;
  noticeVersion: string;
  decidedAt: string;
  expiresAt: string | null;
  choices: Readonly<Record<Exclude<PrivacyCategory, "necessary">, boolean>>;
}
```

### New env vars

None unless the reviewed matrix requires an integration toggle already absent from the stack; any
such variable must be added to SPEC/STACK and reviewed before implementation.

---

## Gate Checks

Run `/phase-gate 34`; standard checks plus:

```bash
pnpm vitest run src/features/privacy-choices src/shared/lib/analytics src/shared/ui/site-footer
pnpm e2e e2e/privacy-legal.spec.ts e2e/home.spec.ts e2e/scenario-pages.spec.ts
pnpm build
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail if the refresh is incomplete or lacks final dated approval/readiness evidence, runtime and
published inventory disagree, non-essential behavior runs before approval, Reject/withdraw is
harder than Accept,
rejection blocks the editor, choice evidence gains an ID, legal content is client-only/absent from
SSR, locale/footer routes diverge, or unapproved metadata/legal claims appear. The Phase-33
readiness report becomes final only after these checks pass.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-34): finalize legal consent and release readiness
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 34`
- [ ] Commit on `feat/phase-34`; tag `v0.34.0` after merge
