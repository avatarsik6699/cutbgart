# PHASE 24 — Legal & Data Governance Audit

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `24` |
| Title | Legal & Data Governance Audit |
| Status | `⏳ pending` |
| Tag | `v0.24.0` |
| Depends on | PHASE_23 gate passing |

---

## Phase Goal

Establish an operator-specific, evidence-backed legal and data-governance contract before adding a
cookie/storage banner, new legal pages, or future metadata collection. This phase inventories the
deployed behavior, determines which regimes and documents apply, drafts the approved content and
implementation matrix, and requires qualified review; it changes no runtime collection
(SPEC.md §3, §5.1–§5.2, §7.2, §7.6, §8).

## Research References

- [GDPR consolidated text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [ePrivacy Directive Article 5(3)](https://eur-lex.europa.eu/eli/dir/2002/58/art_5/par_3/oj/eng)
- [EDPB cookie-banner taskforce report](https://www.edpb.europa.eu/system/files/2023-01/edpb_20230118_report_cookie_banner_taskforce_en.pdf)
- [Russian Federal Law 152-FZ, Article 9](https://www.consultant.ru/document/cons_doc_LAW_61801/6c94959bc017ac80140621762d2ac59f6006b08c/)
- [Russian Federal Law 152-FZ, Article 18](https://www.consultant.ru/document/cons_doc_LAW_61801/cbf4e15b7c330f9372e876cdf2bc928bad7950ef/)
  and [Article 18.1](https://www.consultant.ru/document/cons_doc_LAW_61801/eeeebe22bf738fd65bb66b95cc278911ae2525ee/)
- [Roskomnadzor operator-notification guidance](https://82.rkn.gov.ru/directions/pers/p15375/)
- [Cloudflare Web Analytics data collection](https://developers.cloudflare.com/web-analytics/data-metrics/data-origin-and-collection/)
- [Umami tracker functions](https://docs.umami.is/docs/tracker-functions) and
  [retention FAQ](https://docs.umami.is/docs/faq)

These are planning inputs, not a substitute for advice from a qualified professional for the
operator's actual jurisdiction and market.

---

## Scope

### Data

- [ ] `D1` Complete an owner-facts sheet with legal name/form, registration and service address,
  privacy/legal contact, operator jurisdiction, hosting/entity relationships, target countries and
  languages, intended minors policy, and current/future business model. Unknown facts are explicit
  blockers; the agent must not invent them — _Depends on:_ —
- [ ] `D2` Inspect code, built pages, browser storage/network requests, Nginx/Cloudflare/VPS/Umami
  configuration, model/CDN traffic, logs, Telegram support path, and retention settings. Record
  every current data/storage flow by field/category, source, purpose, recipient, location,
  retention/deletion, access, and whether it can identify or single out a visitor — _Depends on:_
  `D1`
- [ ] `D3` Create a separate proposed-metadata register. For every future field, document the
  concrete product purpose, necessity/minimization, legal basis candidate, recipients/location,
  retention/deletion, access control, user transparency/choice, and whether image/image-derived
  data is prohibited. Unspecified “metadata” is not an approvable category — _Depends on:_ `D1`
- [ ] `D4` Build an applicability matrix for the operator/targets, using Russian 152-FZ and
  GDPR/ePrivacy as baseline regimes plus any additional market identified by `D1`. Resolve
  operator notification, localization/transfers, legal bases, consent form/separation, user
  rights, minors, retention/destruction, security/incident, processor, and record-keeping duties —
  _Depends on:_ `D1`–`D3`
- [ ] `D5` Produce the operational governance set: data-flow map, storage/cookie inventory,
  purpose/legal-basis/retention matrix, processor/transfer register, rights-request procedure,
  retention/deletion schedule, security/incident responsibility checklist, and change-review
  process for any new metadata/integration — _Depends on:_ `D4`
- [ ] `D6` Decide from evidence—not preference—whether the deployed app needs a first-layer consent
  banner, a storage notice only, or another control. Define necessary/non-essential categories,
  default execution gating, consent evidence/expiry/withdrawal, equal Reject/Accept treatment, and
  how current Cloudflare/Umami behavior changes under the decision — _Depends on:_ `D2`, `D4`, `D5`
- [ ] `D7` Approve a bilingual route/footer/content manifest: revised Privacy, Terms of Use,
  Cookie & browser-storage notice, operator/legal notice and separate consent only where required.
  Record explicitly whether a public offer is unnecessary for the current free/no-payment model or
  required for a concrete legal reason — _Depends on:_ `D4`–`D6`
- [ ] `D8` Draft the RU source texts and legally faithful EN counterparts with version/effective
  date, contact and change process. Reconcile every factual claim against `D2`; do not publish
  generic templates or say “compliant” without evidence — _Depends on:_ `D7`
- [ ] `D9` Obtain and record qualified legal review for the actual operator/markets, resolve or
  explicitly reject each finding with the owner, and freeze the Phase-25 implementation matrix and
  approved texts. This phase cannot close with placeholder operator facts or unresolved mandatory
  review findings — _Depends on:_ `D5`–`D8`

### Infra

- [ ] `I1` Add no runtime route, banner, tracker, cookie, metadata field, database, API, or retention
  behavior. Preserve current collection while auditing it; any urgent unlawful/unsafe finding is
  escalated as a separate architect decision rather than silently changing production — _Depends
  on:_ `D9`

---

## Files

### Create / modify

~~~
docs/legal/OPERATOR_FACTS.md
docs/legal/DATA_INVENTORY.md
docs/legal/PROPOSED_METADATA.md
docs/legal/APPLICABILITY_MATRIX.md
docs/legal/GOVERNANCE_CONTROLS.md
docs/legal/IMPLEMENTATION_MATRIX.md
docs/legal/drafts/privacy.ru.md
docs/legal/drafts/privacy.en.md
docs/legal/drafts/terms.ru.md
docs/legal/drafts/terms.en.md
docs/legal/drafts/cookies.ru.md
docs/legal/drafts/cookies.en.md
docs/PHASE_24.md
~~~

### Do NOT touch

- Runtime source, routes, analytics behavior, deployment config, or browser storage
- Add future metadata, accounts, forms, marketing trackers, advertising, payments, or image uploads
- Treat generated copy as legal advice or infer missing operator/jurisdiction facts

---

## Contracts

### New persistent data (tables / collections / files)

Versioned repository documentation under `docs/legal/` only. No production database, cookie,
browser value, identifier, or collected metadata is introduced.

### New API endpoints / RPC methods / events

None.

### New types / models / shared interfaces

None. `docs/legal/IMPLEMENTATION_MATRIX.md` is the reviewed input contract for Phase 25.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 24` after all owner facts and review findings are resolved. Standard documentation
checks apply; additionally verify:

```bash
if rg -n 'TODO|TBD|NEEDS_CLARIFICATION|\[insert|your company' docs/legal; then
  echo "Unresolved legal placeholders found"
  exit 1
fi
pnpm build
```

Fail if the inventory omits any deployed storage/request/log/analytics path, proposed metadata is
not field-level, banner need is assumed without analysis, offer/consent is copied generically,
operator facts remain unknown, factual claims contradict runtime, or qualified-review findings are
unresolved.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
docs(phase-24): define legal and data governance contract
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 24`
- [ ] Commit on `feat/phase-24`; tag `v0.24.0` after merge
