# Cookie and Browser Storage Notice — EN draft

**Content version:** `2026-07-25-draft.2`
**Status:** internal draft; do not publish

`cutbg` uses no advertising cookies and creates no persistent cutbg visitor ID. “Cookies” do not
describe all browser storage: the site also uses localStorage, Cache Storage and volatile memory.

## Necessary technologies

| Technology | Data and purpose | Duration / deletion |
|---|---|---|
| `qualityMode` in localStorage | Explicit `fast` or `max` quality preference | Until changed or site data is cleared |
| Cache Storage and service worker | Verified public model/WASM assets, digest and release; repeat/offline processing | Until user clear, release cleanup, corrupt-entry/quota eviction |
| `cutbgPrivacyChoice` in localStorage | Text version, analytics grant/refusal and local decision/expiry dates; no visitor ID | No more than 180 days |
| Volatile memory/Blob URLs | Source, mask, result and reachable current editing history | Until reset, replacement, tab close or history cleanup |
| Cloudflare security cookies | May appear when an actually enabled bot check/challenge protects the site | Exact enabled names and periods must be verified in Cloudflare settings before publication |

Necessary storage is not used for advertising and is not joined to an analytics profile. The user
can manage model cache and clear local site data.

## Optional analytics

Analytics is off by default. After a separate grant, cookie-less Umami and Cloudflare Web
Analytics scripts load. They read technical page/browser information and send analytics requests,
so being cookie-less does not make them necessary.

`Allow analytics` and `Reject analytics` are available at the same layer and do not affect the
editor. You can change the choice through `Privacy choices`. After refusal or without a choice,
the analytics scripts do not load.

## Not used

No advertising cookies, cross-site tracking, fingerprinting, session replay, heatmaps, account,
shopping-cart/payment storage, or image analytics is used.

## Browser controls

You can clear cookies/site data in your browser. This removes the quality preference, privacy
choice, service worker and model cache, so models download again on the next processing request.
Blocking necessary storage may reduce repeat/offline behavior, but rejecting analytics never
limits editor functions.
