# Data governance controls

**Version:** `0.24.0-draft.2`
**Owner role:** individual controller/operator (full legal identity unresolved)

## Roles

| Role | Responsibilities | Current assignment |
|---|---|---|
| Controller/operator | Approve purposes/bases, public texts, processor contracts, transfers, requests, retention and incident decisions | Individual project owner; full legal identity/address are an owner-accepted deferred risk |
| Privacy/legal contact | Monitor requests, maintain register, coordinate responses and changes | `avatarsik6699@gmail.com`; postal/formal address unavailable |
| Technical maintainer | Enforce local-only image boundary, analytics gating, deletion jobs, access controls, tests and incident evidence | Project maintainer |
| Cloudflare | Edge/CDN/security/Web Analytics processor or service provider according to enabled product and DPA | Contract/entity/config verification required |
| VPS provider and any future backup provider | Infrastructure processors | Exact entity/country belongs in confidential register; no active remote backup is proven |
| Google/Gmail | Email provider for user-initiated privacy requests | Account/entity/retention review required; minimize message content and attachments |
| Telegram | Independent third-party service for a user-chosen support conversation; not the sole legal channel | Telegram entity depends on user/region |
| Hugging Face/jsDelivr | Independent model-asset recipients on fallback only | Contract/transfer role to be documented |
| Umami/Postgres/Uptime Kuma | Self-hosted software inside operator infrastructure, not external controllers | Maintainer-administered |

Access is least privilege: public users cannot access Umami, Postgres, Uptime, releases, backups or
secrets; Uptime uses an SSH tunnel; operational secrets stay in approved host/password stores.

## Purpose and basis register

| Purpose | Minimum data | Basis candidate | Retention | Choice |
|---|---|---|---|---|
| Deliver and secure pages/assets/models | IP and ordinary HTTP/TLS/request metadata; conditional security cookie | Requested service/contract and proportionate legitimate security interest; corresponding 152-FZ basis to be confirmed | Nginx `3 × 10 MiB`; provider plan/config ceiling | Necessary |
| Remember editor quality | `qualityMode` | User-requested functional storage | Until changed/cleared | Necessary after explicit setting |
| Cache verified public models | Asset URL/body/digest/release | User-requested processing and integrity | Until cache eviction/release cleanup/user clear | Necessary after processing request |
| Remember privacy choice | five fields in `PROPOSED_METADATA.md` | Compliance/choice-management necessity | 180 days | Necessary |
| Product funnel analytics | Umami page/session/event fields | Consent | Enforced 90-day maximum | Optional, off by default |
| Web performance analytics | Cloudflare RUM fields | Consent | Verified account ceiling, no longer than 90 days unless approved with evidence | Optional, off by default |
| Respond to support/security message | User's Telegram identity/message and minimal case data | Steps requested by user, consent, legal claim/security interest as applicable | Close/delete when resolved; security evidence follows runbook without real images | User initiated |
| Synthetic monitoring/release/recovery | Monitor URL/status/timing and operator/release metadata | Service security/reliability interest | Existing Phase-23 schedule | No visitor data |

No purpose authorizes image/image-derived telemetry or named user profiling.

## Rights-request procedure

1. Receive requests through `avatarsik6699@gmail.com`. Telegram may forward a request, but cannot
   be the only or required channel. Add a postal/formal route if the applicable rule or process
   requires one.
2. Record only request date, requested right, channel, verification status, systems searched,
   decision, completion date and response location. Do not copy identity documents into git,
   analytics, or routine issue trackers.
3. Verify proportionately. Ask only for information necessary to distinguish the requester; never
   demand an image upload. Where cutbg cannot identify a person from anonymous/session data,
   explain that fact and do not collect new identity solely to make the person identifiable.
4. Search the relevant systems: Umami, bounded proxy logs if still retained, support conversation,
   Uptime/release records only if the request concerns the operator, and processor records where
   applicable. Browser-local data is controlled by the user and is not available to the operator.
5. Apply access, correction, deletion, restriction, objection, portability or withdrawal as
   applicable. Withdrawal immediately stops future optional analytics; it does not retroactively
   make earlier consent-based processing unlawful.
6. Respond in the request language where practical. Internal target: acknowledge within three
   business days and complete within ten business days. Never exceed an applicable statutory
   deadline; GDPR's general outer limit is one month, subject to its documented extension rules.
7. If refusing or unable to identify the data, explain the reason, appeal/complaint route and
   supervisory authority where applicable.
8. Retain the minimal request/response evidence for three years only if required for legal claims
   or compliance; otherwise delete one year after closure. This period requires controller review.

## Retention and deletion schedule

| Store | Ceiling | Enforcement / verification |
|---|---|---|
| Browser editor memory/Blob URLs | Current editing session and reachable history only | Existing lifecycle tests; reset/replacement/unmount cleanup |
| `qualityMode` | Until user change/clear | Phase-34 storage controls expose deletion |
| Model Cache Storage | Until release cleanup, corruption/quota eviction, or user clear | Existing release-named service-worker lifecycle and storage manager |
| Privacy choice | 180 days or policy/category version change | Phase-34 expiry parser and tests |
| Nginx/container logs | Three rotated 10 MiB files per container | Docker log driver; quarterly verify no body/query expansion |
| Umami events/sessions | 90 days | **Missing control:** add tested scheduled deletion and evidence before Phase 24 closes or analytics resumes |
| Uptime monitor history | 90 days | Verify/configure in dashboard/database and quarterly evidence |
| Cloudflare analytics/logs | Account-configured; optional analytics target ≤90 days | Record actual dashboard values quarterly; disable unsupported/unbounded products |
| Release records/config snapshots | Last 10 / last 3 | Existing release controller |
| Backup artifacts, if the script is actually scheduled | 14 days by script default | **Unproven in production:** verify schedule/path/freshness; do not describe as active off-host backup until evidence exists |
| Selected restore-drill artifact, if created | 12 months | Manual dated deletion owner |
| Support messages | Until resolved, then delete/minimize according to Telegram controls; no real images requested | Case closure checklist |
| Rights-request evidence | Proposed one year; three years only where legal-claim/compliance need is recorded | Annual review |

If backups are configured later, they are not an excuse to retain live records indefinitely. A
deletion request removes live data and expires through a bounded encrypted-backup rotation;
exceptional legal hold must be documented with scope, owner and end condition.

## Processor and transfer onboarding

Before enabling a provider or changing region:

1. identify legal entity, role, services, countries and subprocessors;
2. execute/review DPA or equivalent terms and security measures;
3. establish deletion/return, incident notice, audit and government-request terms;
4. determine Russian localization/cross-border notification and GDPR Chapter V mechanism;
5. minimize transmitted fields and disable optional provider telemetry/features;
6. update inventory, public policy and choice before data starts flowing;
7. record owner, review date and evidence location without committing secrets.

Current provider register:

| Provider | Role/data | Location/transfer status | Decision |
|---|---|---|---|
| Cloudflare | Edge request data, CDN, security, optional RUM/NEL | Exact account entity/countries/localization kept confidential and currently unverified | Essential edge requires operator review; RUM gated; NEL disabled |
| VPS provider | Origin logs, Umami/Uptime/operational state | Exact entity/country must be in confidential register, not public Git | Owner-deferred processor/transfer/localization remediation; no completion claim |
| Off-host backup provider | None proven active | Not applicable until configured | Onboard as a new processor before first copy |
| GitHub, Inc. | Maintainer identity, source, CI/release metadata, GHCR | International service; no ordinary visitor analytics | Retain for development, document account terms |
| Google/Gmail | Privacy-request email identity, message and attachments voluntarily sent by requester | Provider account/entity/retention unverified | Publish as contact; enable MFA; request no images/identity documents unless strictly necessary |
| Telegram | User-chosen support identity/message | Cloud service, region-dependent | Optional link with warning; add first-party email |
| Hugging Face / jsDelivr | IP/header plus immutable asset path on fallback | International | Retain only for bounded reliability fallback; disclose; no image data |
| Let's Encrypt/ISRG | Subscriber/domain/certificate/validation data | Public CT and provider systems | Necessary TLS service; disclose only where material |

## Security and incident responsibility

- Technical maintainer follows `docs/runbooks/INCIDENT.md` and
  `docs/runbooks/VULNERABILITY_RESPONSE.md`, preserving no image content.
- Controller determines whether an event is a personal-data breach, affected regimes, authority
  and individual notification, and records the decision and clock.
- Preserve only bounded metadata needed to investigate: time, release/digest, system, category,
  approximate affected count, containment and notices. Do not collect source images to prove an
  incident.
- Rotate exposed credentials, revoke access, stop unlawful processing, and use the immutable
  rollback path. A missing legal contact or processor notice path is a SEV-1 governance defect.

## Change review

This governance set must be reviewed:

- before any new field, provider, tracker, cookie, route/form, account, payment, ad, support bot,
  session replay, heatmap, model host, region or retention change;
- after a material incident or legal change;
- at least annually under `docs/operations/MAINTENANCE.md`.

The review updates `DATA_INVENTORY.md`, `PROPOSED_METADATA.md`,
`APPLICABILITY_MATRIX.md`, public RU/EN texts, tests and the operator/transfer notices as required.
