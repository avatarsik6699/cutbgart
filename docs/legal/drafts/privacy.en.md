# Data Processing and Privacy Policy — EN draft

**Content version:** `2026-07-25-draft.2`
**Status:** internal draft; do not publish
**Publication condition:** Phase 34 refreshes and re-approves `IMPLEMENTATION_MATRIX.md` against
the finished product, then uses the owner-approved minimum public profile without invented facts
or a claim of full legal compliance.

## Minimum identity and accepted risk

The controller is the individual administrator of `cutbg`. The confirmed privacy contact is
`avatarsik6699@gmail.com`. The controller's full legal name and an address adequate for mandatory
identification/formal service have not been supplied. The owner accepted the risk of temporarily
publishing the minimum identification “individual administrator of cutbg” and email; that text
must not be presented as proof of full or universal legal compliance.

Exact VPS/account details, IP addresses and internal topology are not public-policy content.
The operator deferred verification of recipient legal entities/countries, contracts, retention,
localization and transfer mechanisms and accepted that risk. The public version states known
recipient categories and possible international processing without inventing missing details;
analytics remains disabled until the necessary technical checks are complete.

## 1. About this policy

This policy explains what data is processed when you use `cutbg`, why and where it is processed,
how long it is kept, who may receive it, and how you may exercise your rights.

The service is available in Russian and English. The English version must remain legally faithful
to the approved Russian source. Mandatory applicable law prevails.

## 2. What happens to images

Your selected image is processed in your browser. Source pixels, filenames, image metadata, masks,
brush markings, cutouts, composites, and exported files are not sent to a cutbg server, analytics,
or model servers.

Models and software components download to your device and run through WebGPU or WASM. Cutbg has
no server API that accepts images. This does not cover a file you voluntarily send through the
third-party Telegram service; doing that takes place outside the editor and is not required.

## 3. Data processed

### 3.1. Site delivery and security

When you request a page or asset, Cloudflare and the origin infrastructure technically process
your IP address, time, requested page/file, method and response, byte count, protocol, User-Agent,
referrer, and TLS/network/security signals. This is used to deliver and secure the site and models,
limit abuse, and diagnose failures.

Ordinary container logs are limited to three 10 MiB files per service. Cloudflare's exact fields
and retention depend on account settings that remain unverified and will be clarified in a later
policy version.

### 3.2. Optional analytics

Analytics is off until you make a separate affirmative choice.

If you allow analytics, cutbg uses:

- self-hosted Umami: page path without search or hash, title, referrer, browser language, screen
  size, browser/OS/device type, country, analytics session identifiers, and fixed model-load,
  processing and download events;
- Cloudflare Web Analytics: page-load and Core Web Vitals measurements, page address, referrer,
  network/timing characteristics and a technical page-load identifier.

Umami uses IP address and User-Agent to derive location and a session but, according to the
version's documentation, does not store the raw IP. This does not make every output non-personal:
events can still be related to one pseudonymous session.

Analytics never receives your image, filename, mask, brush coordinates, export, email, Telegram
ID, or a persistent cutbg visitor ID. Cutbg does not use `umami.identify`, advertising profiles,
session replay, or heatmaps.

You may reject analytics without losing any editor function and change your choice at any time
through `Privacy choices` in the footer. A grant or refusal lasts no more than 180 days; a material
change to purposes or providers requires a new choice.

### 3.3. Browser storage

- `qualityMode` in localStorage remembers your selected quality until you change it or clear site
  data;
- Cache Storage holds only verified public model/WASM assets for repeat and offline processing and
  can be cleared from the storage manager;
- `cutbgPrivacyChoice` stores policy version, analytics grant/refusal and local decision/expiry
  dates, without a random ID;
- source and processed images remain in browser memory only for the working session.

Umami and Cloudflare Web Analytics set no cookies in the audited normal path. Cloudflare may set
strictly necessary security cookies when a bot check or challenge is enabled; the actual enabled
cookies and durations remain unverified and will be clarified after account review.

### 3.4. Model assets

Public models normally load from `cdn.cutbg.art` through Cloudflare and the cutbg origin. Only
after a verified CDN failure may the same immutable asset be requested from Hugging Face or
jsDelivr. Those recipients see ordinary network request data, never your image or editor state.

### 3.5. Support

Following the Telegram link is optional. Telegram independently processes your account data,
messages and attachments under its own terms. Do not send source images, masks, credentials or
other unnecessary data. Privacy requests use `avatarsik6699@gmail.com`; Telegram is not a required
contact route. A postal/formal route will be added where the applicable procedure requires one.

## 4. Purposes and legal grounds

- delivery and security: performance of the requested service and proportionate legitimate
  security interests, or the corresponding ground under applicable law;
- local settings/cache: providing a function you explicitly requested;
- optional analytics: consent;
- support: steps at your request, consent, legal claims or another applicable ground;
- mandatory records: a specific legal obligation, where one exists.

The final provisions depend on verified jurisdiction and target market. Russian requirements are
the baseline for the Russian audience; deliberate offering in other countries is assessed
separately.

## 5. Recipients and countries

Potential recipient categories include Cloudflare for CDN/security/optional web analytics, the
server-infrastructure provider, Google/Gmail for a voluntary privacy email, Telegram for voluntary
support, Hugging Face/jsDelivr during model fallback, GitHub for development/releases, and Let's
Encrypt for TLS. Umami, Postgres and Uptime Kuma run on operator-managed infrastructure. No active
external backup provider is currently proven.

Exact legal entities, countries, roles, processing terms and transfer safeguards are held in the
confidential register and supplied to a requester/regulator where required. The public policy does
not reveal IP addresses, hostnames, account IDs, internal topology or security settings. Access is
limited to the operator and providers who need it to supply the service.

## 6. Retention

- Umami and Uptime Kuma: no more than 90 days with technically enforced deletion;
- container logs: three rotating 10 MiB files per service;
- local analytics choice: up to 180 days;
- an encrypted backup, if backup is actually configured: no more than 14 days; selected restore
  drill evidence: up to 12 months;
- release records: last 10; configuration snapshots: last 3;
- support messages: until the case is closed and minimized, unless law requires otherwise.

## 7. Your rights

Depending on applicable law, you may request information, access, correction, erasure,
restriction or portability, object to processing, withdraw consent, and complain to a supervisory
authority. Withdrawal does not affect processing lawfully performed before withdrawal.

Send a request to `avatarsik6699@gmail.com`. Cutbg has no accounts. The operator will not collect
additional identity solely to link you to an otherwise anonymous analytics session. You control
browser-local data. Gmail independently processes a voluntarily sent message under its own terms;
do not send images, passwords or unnecessary identity documents.

## 8. Children

The service is not specifically directed to people under 16, does not collect age, and keeps
optional analytics off without a separate choice. Where applicable law does not permit a minor to
give the required consent alone, they should not enable analytics without a parent/representative.
The service does not use child-directed marketing or profiling.

## 9. Changes

The effective date and version are displayed on the page. A material change to categories,
purposes, recipients, or analytics choice invalidates the previous grant and asks for a new choice.
