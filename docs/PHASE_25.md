# PHASE 25 — Consent & Legal Surfaces

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `25` |
| Title | Consent & Legal Surfaces |
| Status | `⏳ pending` |
| Tag | `v0.25.0` |
| Depends on | PHASE_24 gate passing with approved `docs/legal/IMPLEMENTATION_MATRIX.md` |

---

## Phase Goal

Implement the reviewed Phase-24 transparency, legal-page, footer, and privacy-choice contract.
Behavior must match the real data inventory, keep the editor usable after refusal, avoid dark
patterns and false cookie claims, and introduce no future metadata merely because governance is
ready (SPEC.md §3, §5.1–§5.2, §5.4–§5.5, §7.2, §7.5–§7.7, §8).

---

## Scope

### Frontend

- [ ] `F1` Add a versioned legal-content manifest and render the approved bilingual Phase-24 route
  set: revised `/privacy`, `/terms`, `/cookies`, English counterparts, and only conditional
  operator/consent routes listed in the implementation matrix. Include effective date, operator,
  contact, purposes/data/recipients/location/retention/rights, and change navigation exactly where
  approved — _Depends on:_ —
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
  quality/help/model-cache functionality remains available and documented; rejection never blocks
  upload/edit/download — _Depends on:_ `F3`
- [ ] `F5` Store only the approved minimal, versioned choice evidence with no random/user ID.
  Apply the reviewed expiry/re-prompt rule, migrate invalid/old versions safely, and expose an
  always-available footer control to change or withdraw as easily as acceptance — _Depends on:_
  `F3`, `F4`
- [ ] `F6` Keep any separate personal-data consent independent from Terms and other confirmations
  when required by the matrix. Do not request consent where another approved legal basis applies
  and do not add a form or metadata field that Phase 24 did not approve — _Depends on:_ `F1`, `F3`
- [ ] `F7` Add accessible dialog/banner/settings focus management, keyboard operation, screen-reader
  labels/status, no motion dependency, responsive layout, and SSR-readable legal content. Add
  canonical/hreflang/sitemap/meta policy from the approved manifest without making thin pages —
  _Depends on:_ `F1`–`F6`
- [ ] `F8` Add unit/component tests for manifest/versioning, gating-before-choice, accept/reject/
  granular/change/withdraw, no-ID evidence, invalid/expired state, analytics disabled/enabled
  branches, core-service availability, footer/routes/locales, and accessible interactions —
  _Depends on:_ `F1`–`F7`
- [ ] `F9` Add bilingual cross-browser Playwright request/storage inspection: before choice, after
  Reject, Accept, granular settings, withdrawal, and notice-version change. Assert only approved
  cookies/storage/analytics requests occur and complete single plus multiple-upload edit/download
  flows after rejection — _Depends on:_ `F8`

### Infra

- [ ] `I1` Align CSP/script loading and deployment configuration with the approved gating strategy.
  Add no CMP/third-party tracker/package unless Phase 24 explicitly approved it and its license,
  payload, processor, retention, and loading behavior are documented in `docs/STACK.md` — _Depends
  on:_ `F9`

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
docs/legal/
docs/STACK.md
docs/PHASE_25.md
~~~

Conditional routes/files from the approved Phase-24 manifest are added surgically; unapproved
placeholder pages are not created.

### Do NOT touch

- Add server metadata storage, database/API, account, contact form, advertising, or payments
- Change image-local processing or send image/image-derived bytes to analytics
- Add legal claims, processors, categories, routes, consent purposes, or retention beyond the
  reviewed Phase-24 matrix

---

## Contracts

### New persistent data (tables / collections / files)

Only if the Phase-24 matrix requires a stored privacy choice:

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

Run `/phase-gate 25`; standard checks plus:

```bash
pnpm vitest run src/features/privacy-choices src/shared/lib/analytics src/shared/ui/site-footer
pnpm e2e e2e/privacy-legal.spec.ts e2e/home.spec.ts e2e/scenario-pages.spec.ts
pnpm build
pnpm tsc --noEmit
pnpm exec steiger ./src
```

Fail if runtime and published inventory disagree, non-essential behavior runs before approval,
Reject/withdraw is harder than Accept, rejection blocks the editor, choice evidence gains an ID,
legal content is client-only/absent from SSR, locale/footer routes diverge, or unapproved metadata/
legal claims appear.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-25): add approved privacy and legal surfaces
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 25`
- [ ] Commit on `feat/phase-25`; tag `v0.25.0` after merge
