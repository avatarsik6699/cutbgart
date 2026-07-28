# Operator facts: public-safe register

**Document version:** `0.24.0-draft.2`
**Evidence cut-off:** `2026-07-25`
**Status:** `OWNER-APPROVED WITH RECORDED RESIDUAL RISKS`

This repository is public. It therefore contains only facts that are safe to disclose and the
status of confidential checks. Exact infrastructure, account, notification and identity evidence
belongs in the gitignored operator register at `.ops/legal/operator-facts.md`; identity documents,
credentials, IP addresses and contracts must never be committed.

## Confirmed owner decisions

| Fact | Confirmed value | Publication treatment |
|---|---|---|
| Controller form | A private individual operates `cutbg` | The form may be stated publicly; the controller's legally sufficient identity is still missing |
| Privacy contact | `avatarsik6699@gmail.com` | Publish in Privacy, Terms and the footer; monitor it and secure the account |
| Service model | Free, no account, subscription or payment | Publish |
| Target audience | Potentially worldwide | Publish as product scope; assess each deliberately targeted market before promotion |
| Children | Not specifically directed to people under 16; no age collection; optional analytics stays off without consent | Publish; do not add child-directed marketing or profiling without a new review |
| User outputs | Users may use processed images for personal or commercial purposes, subject to rights in their source material | Publish in Terms |
| Hosted-service use | Automated resale, paid access brokerage, white-labelling, bulk exploitation and presenting the hosted service as one's own service are prohibited | Publish with the copyright/open-source limitations described below |
| Postal/legal channel | No public postal address is currently available | Owner-accepted residual risk; email is usable operationally but is not a substitute for every identity/address duty |
| Backups | No off-host or other production backup is known to be configured | Treat Phase-23 backup material as capability/runbook, not evidence of an active copy |

The operator supplied establishment, infrastructure-location and regulatory-status facts
confidentially. Their values are not repeated in this public repository. The legal assessment uses
them, while public texts disclose only what a visitor needs: processing categories, recipient
categories, transfer fact, safeguards/status, rights and contact. Exact VPS hostname/IP, internal
topology, credentials and security configuration are never public-policy content.

## Verified product facts

| Fact | Verified value | Evidence |
|---|---|---|
| Public service | `cutbg`, `https://cutbg.art` with RU base routes and EN `/en` routes | deployed SSR pages, `docs/SPEC.md` |
| Image processing | Source images, masks, prompts, composites and exports remain in browser memory; no application endpoint accepts image content | source/network audit in `DATA_INVENTORY.md` |
| Current support | User-initiated Telegram link; the confirmed privacy email is not yet published in runtime | source and deployed pages |
| Current analytics | Self-hosted Umami plus Cloudflare Web Analytics load on every public page when production variables are configured | deployed browser/network audit |
| Current infrastructure categories | Cloudflare-proxied domain/model CDN, one origin, Nginx, Umami/Postgres, Uptime Kuma, GitHub Actions/GHCR and Let's Encrypt | Compose, CI, deployment and operations docs |
| Current retention evidence | container logs rotate at `3 × 10 MiB`; documentation targets 90 days for Umami/Uptime; backup tooling targets 14 days but active scheduling/off-host storage is not proven | repository configuration and owner confirmation |

## Deferred facts and accepted residual risks

| Required fact/decision | Why it matters | Status |
|---|---|---|
| Full legal name of the individual controller | Russian access/transparency rules and GDPR Article 13 require controller identification when applicable | **OWNER-DEFERRED — Phase-35 text may use individual administrator + privacy email without claiming full compliance** |
| Address suitable for legally required identification/service | Some notices and formal requests require an address; publishing email alone leaves risk | **OWNER-DEFERRED — no channel exists** |
| Exact Cloudflare account entity, DPA/subprocessors, enabled products/cookies, NEL, log retention and localization settings | Determines roles, data, storage and transfer controls | **OWNER-DEFERRED — optional analytics stays disabled until applicable settings/retention are verified** |
| Exact VPS contracting entity/country and processor terms | Must exist in the confidential processor/transfer register even if not advertised publicly | **OWNER-DEFERRED — record before active promotion or a material infrastructure change** |
| Whether any local or remote backup job actually runs | Code and runbooks do not prove production execution | **Confirmed as not known/configured; verify on host** |
| Russian notification, localization and transfer remediation evidence | Required before representing the service as having resolved Russian operator duties | **OWNER-DEFERRED — status kept only in confidential register; no compliance claim permitted** |
| GDPR Article 3/27 and Chapter V decision for deliberate EEA targeting | “Worldwide” can include offering a free service to EEA users; accessibility alone is not decisive | **ASSESS BEFORE EEA PROMOTION** |
| Qualified legal review | Reduces interpretation/enforcement risk but is unavailable | **RISK ACCEPTED — owner directed closure without counsel on `2026-07-25`** |

## Public-disclosure boundary

The operator prefers minimum public disclosure. The defensible boundary is:

- publish the legally sufficient controller identity/contact once available, purposes, data
  categories, legal bases, recipient categories, transfer fact/safeguards, retention, choices and
  rights;
- keep exact provider account IDs, VPS hostname/IP, internal region/topology, secrets, contracts
  and security settings confidential;
- provide exact processor legal entities/countries to a verified requester or regulator where the
  applicable rule requires it, while keeping the public text at category level where lawful;
- never conceal a transfer by claiming that no personal data is processed.

Low traffic, free access and not advertising the infrastructure do not create an exemption.

## Intellectual-property boundary

The repository currently has no root `LICENSE` and `package.json` is marked `private`. That does
not license proprietary project code for commercial reuse, although GitHub's platform terms still
permit viewing and forking a public repository. The Terms may prohibit use of the hosted service
as a resold API/white-label product and copying protected project code, text, design and branding.

They cannot honestly grant a monopoly over the general idea, method, algorithm or independently
implemented background-removal pipeline. Third-party packages and models remain governed by their
own licences. Before stronger enforcement is needed, add an explicit repository licence/notice
after checking every dependency/model licence and ownership contribution.

Primary references:

- [152-FZ Article 14(7) — access information](https://www.consultant.ru/document/cons_doc_LAW_61801/34585db685164ddd73440bf08348903bff6715aa/)
- [GDPR Article 13 — controller identity and processing information](https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng)
- [Civil Code Article 1259 — protected expression, not ideas/methods](https://www.consultant.ru/document/cons_doc_LAW_64629/be05678dc42ddc67aae5be9ba9beebd367fb9a3f/)
- [Civil Code Article 1261 — protection of software code](https://www.consultant.ru/document/cons_doc_LAW_64629/ce1359ed5b9bd99896d7a496c7887e7c223a2cbc/)
- [GitHub repository licensing guidance](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)
