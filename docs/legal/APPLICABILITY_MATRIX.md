# Applicability and legal-basis matrix

**Version:** `0.24.0-draft.2`
**Assessment date:** `2026-07-25`
**Status:** engineering/legal desk review, not a qualified legal opinion

## Decision method

The owner confirmed that the controller is an individual, supplied establishment and
infrastructure-location facts to the confidential register, and declared a potentially worldwide
audience. Full identity/address, exact provider facts, contracts and Cloudflare account settings
remain unresolved. The matrix therefore distinguishes:

- **observed fact** — demonstrated by code, deployment, or official provider documentation;
- **conditional duty** — applies if the stated territorial/controller condition is true;
- **release decision** — conservative control selected for Phase 25 regardless of final
  territorial outcome.

Vendor statements such as “anonymous” or “GDPR compliant” do not decide the legal classification.
IP addresses, online identifiers, session UUIDs, request sequences, and device combinations are
treated as personal or potentially personal where a party can single out a visitor/session.

## Russian Federal Law 152-FZ baseline

| Topic | Finding | Required action / blocker |
|---|---|---|
| Territorial/operator applicability | The confidential owner record and Russian base locale make the Russian baseline directly material; the exact residence/address is not published here | Treat 152-FZ as an implementation baseline and resolve notification, localization and transfers before active promotion |
| Personal data | Cloudflare/Nginx process IP, headers and request history; Umami derives location/device and stores session-linked events; Telegram receives account/message data on voluntary contact | Do not claim “no personal data.” Publish field-level purposes, recipients, terms and rights |
| Lawful basis | Page delivery/security is necessary for the user-requested service and protection of the site; product analytics is not necessary | Record the exact 152-FZ Article 6 basis per purpose. Use separate, specific, informed and unambiguous consent for optional analytics |
| Separate consent | Article 9, as amended in 2025, requires consent to be separate from other information/documents the person confirms | Phase-25 analytics choice must not be bundled into Terms or mere continued use |
| Operator notification | Article 22 generally requires notice before automated processing, with narrow remaining exceptions | The confidential register records no completed notification evidence. Validate exceptions, then file/update before qualifying processing; record purposes, categories, subjects, actions, methods, responsible person, database location and transfers |
| Initial localization | Article 18(5) restricts initial recording/systematization/storage of Russian citizens' personal data in foreign databases | The confidential infrastructure fact creates a remediation question, not a disclosure workaround. Determine which collection databases are in scope; localize initial collection or stop the affected processing |
| Cross-border transfer | Article 12 requires a separate prior notice and recipient/country/security information; transfers may be restricted | Inventory Cloudflare entities/subprocessors, Telegram, Hugging Face/jsDelivr, off-host backup, and any foreign VPS provider before filing/continuing a qualifying transfer |
| Public policy | Article 18.1 requires a publicly accessible processing policy and organizational/security measures | Replace the current short privacy marketing page with the approved policy; keep internal governance controls |
| Security and incidents | Article 19 and related duties require proportionate organizational/technical measures and response | Reuse Phase-22/23 controls; add the rights, retention, processor and legal-change controls in `GOVERNANCE_CONTROLS.md` |
| Retention/destruction | Purpose-specific periods and deletion procedures must be documented and executed | Enforce the stated Umami/Uptime 90-day ceiling; current docs alone are insufficient |
| Children | Owner approved: not specifically directed to under-16s; no age collection | Keep analytics off by default; no child-directed marketing/profiling. Reassess before any age-dependent feature |

Primary references:

- [152-FZ Article 9 — separate and revocable consent](https://www.consultant.ru/document/cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/)
- [Article 12 — cross-border transfer notice](https://www.consultant.ru/document/cons_doc_LAW_61801/e4ebbe1780de623c7cf32a59ca82a7bb523a25dd/)
- [Article 14 — access information, recipients and transfers](https://www.consultant.ru/document/cons_doc_LAW_61801/34585db685164ddd73440bf08348903bff6715aa/)
- [Article 18 — collection and localization](https://www.consultant.ru/document/cons_doc_LAW_61801/cbf4e15b7c330f9372e876cdf2bc928bad7950ef/)
- [Article 18.1 — public policy and organizational measures](https://www.consultant.ru/document/cons_doc_LAW_61801/eeeebe22bf738fd65bb66b95cc278911ae2525ee/)
- [Article 22 — operator notification](https://www.consultant.ru/document/cons_doc_LAW_61801/d996966e22e1320c9de1ab82d9f6be12c3d9d765/)

## GDPR baseline

| Topic | Finding | Required action / decision |
|---|---|---|
| Territorial scope | The owner declared a potentially worldwide audience. Accessibility alone does not prove EEA targeting, but deliberate EEA offering/monitoring may trigger Article 3(2), including for a free service | Follow GDPR-grade transparency/choice globally; complete a documented Article 3 assessment before EEA-directed promotion |
| Controller identity | Individual controller and privacy email confirmed; full legal identity/address unresolved | Public legal text cannot be approved as Article-13 complete until identity/contact requirements are met |
| Data minimization/purpose | Core service does not need accounts or image upload; current analytics is narrow but session-linked | Preserve local-only image boundary; no new fields; do not join analytics to a named person |
| Core page/model delivery | Ordinary request metadata is needed to deliver the service and protect it | Candidate basis: Article 6(1)(b) for user-requested delivery and/or 6(1)(f) for proportionate security. Record a balancing assessment for 6(1)(f) |
| Optional analytics | Umami and Cloudflare RUM are useful, not necessary for image processing | Candidate basis: Article 6(1)(a) consent; do not load before grant |
| Transparency | Current page omits controller, recipients, locations, periods, rights and transfers, and makes an absolute no-personal-data claim | Publish the approved Article-13-level RU/EN privacy policy before analytics resumes |
| Processor contracts | Cloudflare and the VPS provider process on the operator's behalf; no active external backup provider is proven; Umami is self-hosted software, not a separate recipient | Verify Article 28 terms/DPA, security, deletion, audit and subprocessor provisions |
| International transfers | Cloudflare/Telegram/Hugging Face/jsDelivr/GitHub entities and unknown infrastructure may involve third countries | Record roles and countries; where GDPR applies, document adequacy or Article 46 safeguards and supplementary assessment |
| Data-subject rights | No account exists and Umami deliberately avoids direct identification | Provide access/objection/erasure/restriction/contact workflow. Under Article 11, do not collect extra identity solely to identify an otherwise unidentifiable session |
| Children | Service is not specifically directed to under-16s and does not collect age | Default analytics off; if the service becomes child-directed, redesign consent under Article 8 before release |
| DPIA/DPO/representative | No high-risk systematic profiling, special-category processing, or large-scale sensitive data is approved | DPIA/DPO do not appear triggered by the approved design, subject to scale/facts. Assess Article 27 representation if Article 3(2) applies; reassess on targeting, scale, new metadata, session replay, accounts or image egress |
| Breach handling | Security runbooks exist but legal notification ownership is not named | Add controller-specific incident assessment and applicable authority/data-subject notification clock |

Primary reference: [GDPR consolidated text](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng),
especially Articles 3, 5–8, 11–22, 28, 32–34 and 44–49.

## ePrivacy / terminal-storage baseline

Article 5(3) protects storing information on, or accessing information from, terminal equipment;
it is not limited to cookies. Consent is not required only where the operation is strictly
necessary for the transmission or service explicitly requested by the user.

| Browser operation | Classification / decision |
|---|---|
| `qualityMode` localStorage after the user changes quality | Functional preference supporting the requested editor; disclose as necessary storage |
| Model/WASM Cache Storage after processing is requested | Necessary for delivery, integrity and repeat/offline processing; disclose and offer clear control |
| `cutbgPrivacyChoice` proposed localStorage | Necessary to remember grant/refusal and prevent unchosen analytics; disclose |
| Cloudflare challenge/security cookies if actually enabled | Treat as necessary security storage, disclose exact enabled cookies and durations |
| Umami page/session measurement | Non-essential analytics; require prior affirmative choice |
| Cloudflare Web Analytics/RUM | Non-essential performance analytics; require prior affirmative choice |
| Cloudflare NEL browser reports | Non-essential browser reporting; disable at zone level rather than adding another category |

References:

- [ePrivacy Directive Article 5(3)](https://eur-lex.europa.eu/eli/dir/2002/58/art_5/par_3/oj/eng)
- [EDPB cookie-banner taskforce report](https://www.edpb.europa.eu/documents/task-force-report/report-of-the-work-undertaken-by-the-cookie-banner-taskforce_en)

## Provider findings

| Provider/service | Official finding | Consequence |
|---|---|---|
| Umami 3 | Default payload includes host, language, referrer, screen, title, URL and website ID; IP is used for metrics but documented as not stored; sessions/events are persisted | Treat output as pseudonymous/session-level data; no `identify`; enforce retention; gate the script |
| Cloudflare Web Analytics | Uses a JS performance beacon, no cookie/localStorage and no cross-property tracking; sends timings to Cloudflare | Cookie-less does not remove network/terminal transparency; gate the beacon |
| Cloudflare edge | Cloudflare DPA treats customer as controller and Cloudflare as processor; security products may set necessary cookies and process globally unless localization controls are purchased/configured | Verify DPA/entity/subprocessors/settings; disclose and document transfers |
| Cloudflare NEL | Receives network-failure reports; Cloudflare says raw IP is transient and purged after deriving aggregate network location | Disable as non-essential until deliberately approved |
| Telegram | Cloud chats and account/message metadata are handled by Telegram across its cloud service | Treat Telegram as an optional third-party/independent controller; do not make it the only rights channel |

Official provider references:

- [Umami metric definitions](https://docs.umami.is/docs/metric-definitions)
- [Umami tracker functions](https://docs.umami.is/docs/tracker-functions)
- [Cloudflare Web Analytics collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
- [Cloudflare cookies](https://developers.cloudflare.com/fundamentals/reference/policies-compliances/cloudflare-cookies/)
- [Cloudflare Network Error Logging](https://developers.cloudflare.com/network-error-logging/)
- [Cloudflare Customer DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)
- [Telegram privacy policy](https://telegram.org/privacy)

## Consent/notice decision

The approved implementation target is **a storage notice plus a separate optional analytics
choice**, not a generic “we use cookies” banner:

1. Analytics is off before a choice.
2. First layer gives equally clear `Accept analytics` and `Reject analytics` actions.
3. Closing/ignoring the layer keeps analytics off and does not block the editor.
4. A persistent `Privacy choices` footer control permits withdrawal/change as easily as grant.
5. Necessary storage is explained but not presented as optional consent.
6. No pre-ticked control, cookie wall, scroll-to-consent, or consent bundled into Terms.
7. A rejected choice is respected for 180 days unless the user clears it; a material policy or
   category change invalidates the old choice.

## Terms/public-offer decision

The observed service is free, has no payment, subscription, account or promised paid deliverable.
The draft therefore uses **Terms of Use**, not a paid-service public offer. Users may commercially
use their processed outputs if they hold rights to the source. They may not resell/white-label the
hosted service or copy protected project code/brand, subject to third-party licences and the rule
that copyright does not monopolize an idea, method or independently created pipeline. If payments,
subscriptions, business accounts, warranties or paid support appear, reopen the decision.

## Accepted residual risks and later remediation

- full operator legal identity and an adequate address/formal channel are owner-deferred; privacy
  email is confirmed;
- exact target-market campaigns beyond the declared worldwide availability;
- VPS provider/country and proof of whether any production/off-host backup exists, recorded
  confidentially rather than exposed in Git;
- Cloudflare contracting entity, DPA/subprocessors, bot-cookie/NEL/log/localization settings;
- Roskomnadzor notification/localization/cross-border remediation evidence;
- GDPR representative/transfer/DPA analysis if GDPR applies;
- technically enforced Umami/Uptime 90-day deletion;
- qualified professional review is deferred by explicit owner risk acceptance dated `2026-07-25`.
