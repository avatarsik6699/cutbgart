# Proposed metadata register

**Version:** `0.24.0-draft.2`
**Decision:** no new server-side visitor metadata is approved

Every future field must appear here before implementation. An unspecified category such as
“usage metadata,” “diagnostics,” or “AI improvement data” is rejected.

## Phase-25 local privacy choice

One browser-local record is approved for implementation because it prevents non-essential code
from running without a choice:

| Field | Type / values | Purpose and necessity | Location / recipients | Retention and deletion | Legal treatment |
|---|---|---|---|---|---|
| `schemaVersion` | integer `1` | Safe migration of the record | `localStorage` on `cutbg.art`; no server recipient | Removed with the whole record | Strictly necessary choice evidence |
| `policyVersion` | fixed published version such as `2026-07-25` | Re-request choice after a material policy/category change | Same | Until expiry/version change/user clear | Strictly necessary |
| `analytics` | `"granted"` or `"denied"` | Gate Umami and Cloudflare Web Analytics | Same; only `"granted"` permits subsequent analytics requests | 180 days maximum; overwritten immediately on change | Separate optional consent state |
| `decidedAt` | UTC ISO timestamp generated locally | Demonstrate recency and calculate expiry | Same | 180 days maximum | Necessary consent metadata |
| `expiresAt` | UTC ISO timestamp exactly 180 days after decision | Automatic expiry without a server profile | Same | Record becomes invalid at this time and is replaced only after a new choice | Necessary consent metadata |

Proposed key: `cutbgPrivacyChoice`. It contains no random visitor ID, account ID, IP, device hash,
page history, or copy of analytics events. Refusal is stored as readily as acceptance. The user can
continue without interacting; in that case no record is required and analytics remains off.

## Existing local preference retained

`qualityMode` (`fast` or `max`) remains an existing functional preference. It is not consent
evidence and must not be joined to analytics. It is set only after an explicit choice and can be
deleted from the storage manager/privacy controls.

## Phase-32 help-state reservation

No help/onboarding field is approved yet. Before Phase 32, its phase contract must enumerate a
local-only schema limited to content version and dismissed/completed help IDs, with no timestamps,
visitor ID, cross-device sync, or analytics linkage unless separately reviewed here.

## Explicitly prohibited

The following are not approved for collection, persistence, analytics, support automation, model
improvement, or consent evidence:

- image pixels, thumbnails, crops, masks, alpha mattes, composites, prompts/brush coordinates,
  embeddings, perceptual or cryptographic image hashes;
- source filenames, EXIF, local paths, download filenames, or user-supplied image URLs;
- email, phone, Telegram ID, account/profile identifiers, advertising IDs, fingerprinting inputs,
  or cross-site identifiers;
- raw IP address or full User-Agent in an application database;
- persistent device/session IDs created by cutbg;
- per-image inference timing, quality scores, failure dumps, memory snapshots, or model inputs
  linked to a browser/session;
- session replay, heatmaps, DOM capture, keystroke capture, or support-chat ingestion;
- precise location, contacts, camera, microphone, payment, USB, or browsing-topic data;
- special-category, biometric-identification, criminal-offence, or child-profile data.

## Existing analytics is not “future metadata”

Umami's current page/session fields and the Cloudflare RUM fields are inventoried in
`DATA_INVENTORY.md`. Phase 25 may retain them only after the approved analytics choice and may not
add `umami.identify`, custom IDs, session replay, heatmaps, or new event dimensions without a new
review and version bump to this register.

## Change gate

For any proposed field, the owner must document before implementation:

1. exact name, type and allowed values;
2. one concrete product purpose and why aggregate/local alternatives are insufficient;
3. legal-basis candidate and any terminal-storage/consent requirement;
4. recipients, processor role, countries and transfer safeguard;
5. retention/deletion mechanism that is technically enforced;
6. access controls and rights-request behavior;
7. exact RU/EN transparency and choice changes;
8. tests proving prohibited image and identifier data cannot enter the field.
