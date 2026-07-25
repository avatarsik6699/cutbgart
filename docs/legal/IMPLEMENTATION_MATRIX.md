# Phase-25 implementation matrix

**Version:** `0.24.0-draft.2`
**Content version:** `2026-07-25`
**Status:** owner-approved with recorded residual risks; optional analytics remains fail-closed
until applicable technical/provider checks pass

This is the only approved input contract for Phase 25. It does not authorize implementation during
Phase 24.

## Product decision

Use a **necessary-storage notice plus a separate optional analytics choice**. Do not label the
whole surface a cookie banner because the audited analytics is cookie-less and the browser also
uses localStorage/Cache Storage.

### Before choice

- render the entire editor and all legal pages;
- do not insert/fetch the Umami tracker or Cloudflare Web Analytics beacon;
- do not call `window.umami`, `/api/send`, or Cloudflare RUM;
- permit necessary Cloudflare edge/security processing, SSR/static/model delivery, functional
  local storage and model caching;
- no choice record is required if the visitor ignores/closes the layer; analytics remains off.

### First layer

RU actions:

- `Разрешить аналитику`
- `Отклонить аналитику`
- `Настройки и подробности`

EN actions:

- `Allow analytics`
- `Reject analytics`
- `Settings and details`

Accept and Reject use equal visual prominence, keyboard order and hit area. No pre-ticked box,
cookie wall, countdown, scroll-to-consent, implied consent, or disabled editor.

### Settings

| Category | Default | User control | Contents |
|---|---|---|---|
| Necessary | On | Informational, cannot be disabled inside the app | Page/model delivery, security, `qualityMode`, model cache, privacy-choice record, conditional Cloudflare security cookies |
| Analytics | Off | On/off | Umami pageviews/fixed product events and Cloudflare Web Analytics |

No advertising, personalization, session replay, heatmap or image-improvement category exists.

### Choice lifecycle

- persist exactly `cutbgPrivacyChoice` from `PROPOSED_METADATA.md`;
- validity: 180 days;
- invalidate on content/category/purpose/provider change;
- footer exposes `Настройки приватности` / `Privacy choices` on every public route;
- withdrawal prevents all future optional requests immediately and removes loaded analytics
  scripts/listeners where feasible; no reload should be required to stop future events;
- grant after refusal may load analytics once without duplicating the current pageview;
- clearing site data returns to default-off;
- Do Not Track may force analytics off, but must never silently turn a prior denial into grant.

## Analytics minimization

If granted:

- keep Umami auto pageviews and existing fixed event allowlist;
- keep only `qualityMode` and `inferencePath` event dimensions;
- never call `umami.identify`;
- set `data-exclude-search="true"` and `data-exclude-hash="true"`;
- set `data-do-not-track="true"`;
- do not enable Umami performance, session replay, heatmaps, custom IDs or arbitrary event data;
- keep Cloudflare Web Analytics limited to current aggregate RUM;
- enforce 90-day Umami deletion before activation and record actual Cloudflare retention;
- tests fail on filename, image, hash, prompt, mask, composite, raw error text, URL query, custom
  visitor ID or new dimension.

Disable Cloudflare Network Error Logging at the zone level. If a later phase wants NEL, it must be
added as an exact field-level proposal with choice/basis/retention review.

## Route and footer manifest

| RU route | EN route | Content |
|---|---|---|
| `/privacy` | `/en/privacy` | Full controller/data-processing policy based on approved draft |
| `/terms` | `/en/terms` | Free-service Terms of Use; not presented as a paid public offer |
| `/cookies` | `/en/cookies` | Cookie and browser-storage notice |
| No separate route | No separate route | Minimum operator identification/contact appears in footer, Privacy and Terms |
| Footer/modal control | Footer/modal control | Persistent privacy choices and withdrawal |

The sitemap, canonical/hreflang metadata, SSR content, footer links and accessibility names cover
both locales. A separate broad “personal data consent” page is not created. Optional analytics
consent is a distinct, versioned choice, separate from Terms, with links to the Privacy and Storage
notices.

## Public content prerequisites and accepted deferrals

Before the drafts may be converted to production content:

1. publish the confirmed `avatarsik6699@gmail.com` and identify the operator as the individual
   administrator. Full legal name/address are owner-deferred; do not claim the resulting minimum
   disclosure is universally compliant and update it when those details become available;
2. record exact VPS/entity/country, contract and any backup destination in the confidential
   processor register; publicly state recipient categories and transfer fact/safeguard without
   exposing IP, hostname, account ID or internal topology;
3. keep optional analytics disabled until Cloudflare account entity/DPA/subprocessors/localization,
   security-cookie and retention settings needed for the enabled products are verified;
4. preserve Roskomnadzor notification, localization and cross-border actions as explicit
   owner-owned remediation; do not claim they are complete without evidence;
5. assess GDPR territorial scope before EEA-directed promotion and resolve representative/transfer
   safeguards if applicable;
6. preserve the approved minors position (not specifically directed to under-16s) and commercial
   use position (commercial outputs allowed; hosted-service resale prohibited within lawful IP and
   third-party licence limits);
7. display the `2026-07-25` owner risk-acceptance record in repository governance; never describe
   the agent desk review as qualified legal advice.

No placeholder identity may ship.

## Operational controls required with Phase 25

- implement and test rolling deletion for Umami data older than 90 days;
- verify/configure Uptime history at 90 days;
- record actual Cloudflare data/log retention and enabled cookies/features quarterly;
- publish and monitor `avatarsik6699@gmail.com`, secure it with MFA, and keep the request register
  outside git;
- update backup deletion evidence when a live record expires;
- preserve existing local-only image/no-egress tests.

The Umami retention gap and unknown processor locations are not cosmetic documentation issues.
Analytics must remain disabled until they are resolved.

## Behavioral and privacy tests

Playwright must verify in RU and EN:

1. fresh context loads app with zero `/api/send` and zero Cloudflare RUM requests;
2. editor upload/process/edit/download works after Reject;
3. Reject and Accept are equally discoverable and keyboard accessible;
4. Accept loads only approved scripts and payload keys;
5. navigation records expected pageviews only after grant;
6. withdrawal stops subsequent analytics and persists denial;
7. expiry/version mismatch returns to default-off;
8. `qualityMode`, model Cache Storage and clear controls work independently of analytics choice;
9. no normal-load cookie; any enabled Cloudflare security cookie is classified/disclosed;
10. URLs/query strings, filenames and image-derived values never enter analytics;
11. legal/footer routes SSR correctly with canonical/hreflang and current content version;
12. storage/request behavior matches the notices.

## Release decision

Phase 25 must fail closed: missing/invalid choice state means analytics off. If retention
enforcement or processor/transfer evidence is unavailable, ship the core editor and minimum
owner-approved transparency with browser analytics disabled rather than publishing invented facts
or running unapproved collection.
