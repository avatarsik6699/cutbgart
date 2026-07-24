# PHASE 34 — Accessibility, Device & Product Validation

<!-- TOKEN BUDGET: keep this file under 10,000 tokens. Be concise. -->

## Phase Metadata

| Field | Value |
|-------|-------|
| Phase | `34` |
| Title | Accessibility, Device & Product Validation |
| Status | `⏳ pending` |
| Tag | `v0.34.0` |
| Depends on | PHASE_33 gate passing |

---

## Phase Goal

Validate the finished focused background editor as a product, not only as a passing test suite.
This phase combines a manual WCAG 2.2 AA audit, assistive-technology and physical-device evidence,
RU/EN editorial review, focused usability sessions, visual/performance regression coverage, and a
public accessibility statement. It fixes release-blocking findings while keeping the product
boundary focused on background removal and related editing (SPEC.md §5, §7–§9).

## Research References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [W3C Evaluating Web Accessibility Overview](https://www.w3.org/WAI/test-evaluate/)
- [W3C WCAG-EM 1.0](https://www.w3.org/TR/WCAG-EM/)
- [web.dev Baseline](https://web.dev/baseline)
- [Core Web Vitals](https://web.dev/articles/vitals)
- [Nielsen Norman Group — Usability Testing 101](https://www.nngroup.com/articles/usability-testing-101/)

---

## Scope

### Accessibility

- [ ] `A1` Freeze representative pages, locales, breakpoints and states—including upload,
  processing, failure, single/batch editing, Cutout Magic/Manual, Enhancements, Background,
  Download, dialogs, onboarding and legal/privacy controls—and audit them with WCAG-EM against
  WCAG 2.2 AA. Automated results are supporting evidence, not the audit conclusion — _Depends on:_
  —
- [ ] `A2` Manually verify full keyboard and visible focus, focus order/restoration, pointer
  alternatives, zoom/reflow at 200% and 400%, text spacing, contrast, forced colors, reduced
  motion, announcements and error recovery. Canvas editing must have an operable non-pointer
  path or a documented equivalent workflow — _Depends on:_ `A1`
- [ ] `A3` Test at minimum NVDA with current supported Windows browser and VoiceOver with Safari;
  include browser/AT versions and limitations. Validate names, roles, states, live regions,
  dialogs, tool selection, batch status, history and download without relying on icon, color or
  canvas pixels alone — _Depends on:_ `A1`
- [ ] `A4` Remediate all reproducible P0/P1 accessibility findings and add regression coverage.
  P2/P3 findings need owner, rationale and target phase/date; unverifiable claims are removed —
  _Depends on:_ `A2`, `A3`
- [ ] `A5` Publish localized `/accessibility` and `/en/accessibility` pages with evaluated scope,
  standard/target, tested technologies, known limitations, owned contact, effective date and
  review cadence. Do not claim universal compliance — _Depends on:_ `A4`

### Device, browser and performance validation

- [ ] `D1` Freeze a supported-browser policy and degradation matrix using current Baseline evidence:
  full support, supported fallback, and unsupported. Cover WebGPU absent/denied, low memory,
  storage quota, offline/interrupted CDN, touch/pointer differences and reduced motion —
  _Depends on:_ `A1`
- [ ] `D2` Run the core single and batch journeys on a small physical-device matrix: iPhone/Safari,
  Android/Chrome including one constrained device, macOS/Safari, Windows Chromium on integrated
  graphics, and a no-WebGPU path. Record exact hardware/OS/browser, outcome, thermal/memory notes
  and gaps; a cloud device may supplement but not replace both mobile physical checks —
  _Depends on:_ `D1`
- [ ] `D3` Re-run measured Core Web Vitals, interaction latency, long tasks, memory growth and batch
  limits on representative devices after Phase 33. Fix P0/P1 freezes, crashes, leaks or budget
  regressions; document evidence-based supported limits rather than promising every device —
  _Depends on:_ `D2`
- [ ] `D4` Add stable screenshot/visual-regression coverage for representative RU/EN desktop/mobile
  states in the deterministic CI browser. Review intentional baselines; exclude nondeterministic
  model pixels and animation frames rather than masking structural regressions — _Depends on:_
  `A1`, `D1`

### Product and content validation

- [ ] `P1` Run moderated task-based sessions with representative novice users for: first
  single-image result, fixing an edge, replacing background, downloading, processing several
  images, recovering from an error, and finding privacy/help controls. Obtain consent, use
  synthetic/user-owned images, collect no production telemetry, and record observations without
  unnecessary personal data — _Depends on:_ `A1`
- [ ] `P2` Prioritize findings by severity/frequency. Fix all reproducible task blockers and
  misleading labels/instructions; unresolved findings require owner, rationale and target. Do not
  expand into a general design suite to address a focused-editor finding — _Depends on:_ `P1`
- [ ] `P3` Perform native-speaker RU/EN editorial QA across primary UI, errors, onboarding,
  accessibility and approved legal surfaces: terminology, tone, pluralization, truncation and
  semantic parity. Legal translations still require the review defined in Phase 24 — _Depends on:_
  `P2`
- [ ] `P4` Produce a launch/readiness report linking audit evidence, supported matrix, performance
  results, known limitations and remaining risk. Product readiness cannot be marked PASS with an
  unresolved P0/P1 accessibility, device, privacy, security or core-task finding — _Depends on:_
  `A5`, `D2`–`D4`, `P2`, `P3`

---

## Files

### Create / modify

~~~
docs/audits/PHASE_34_ACCESSIBILITY.md
docs/audits/PHASE_34_DEVICES.md
docs/audits/PHASE_34_USABILITY.md
docs/audits/PHASE_34_CONTENT.md
docs/audits/PHASE_34_READINESS.md
docs/STACK.md
src/
locales/
tests/
e2e/
docs/PHASE_34.md
~~~

### Do NOT touch

- Add general-purpose layers, product-card design, collaboration, accounts, billing or cloud files
- Replace manual/assistive/physical evidence with Lighthouse, axe or emulation alone
- Use production user images, session replay, undisclosed research recording or unnecessary PII
- Publish “fully accessible”, “all devices” or legal-compliance claims unsupported by the audit

---

## Contracts

### New persistent data (tables / collections / files)

Versioned audit reports and approved deterministic screenshot baselines only. Research notes must be
minimized/de-identified with owner-approved access, retention and deletion from Phase 24. No new
application persistence or production telemetry.

### New API endpoints / RPC methods / events

| Method | Path | Auth | Response |
|--------|------|------|----------|
| `GET` | `/accessibility` | public | RU accessibility statement |
| `GET` | `/en/accessibility` | public | EN accessibility statement |

### New types / models / shared interfaces

None.

### New env vars

None.

---

## Gate Checks

Run `/phase-gate 34`; the complete `docs/STACK.md` gate and all Phase-34 targeted suites apply:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
pnpm e2e:ci-critical
pnpm e2e
```

Attach manual WCAG-EM, NVDA/VoiceOver, physical-device, performance, visual, usability and bilingual
editorial evidence. Verify both accessibility routes and owned contact. Fail if a P0/P1 is open,
mandatory evidence is emulation-only, browser/device support is overstated, research data lacks
retention, or the readiness report cannot trace each conclusion to evidence.

---

## Architect Review Notes

- [x] No architect review issues recorded

## Implementation Notes

None

## Atomic Commit Message

```text
feat(phase-34): validate accessibility devices and product readiness
```

## Post-Phase Checklist

- [ ] Scope complete; gates green; review notes resolved
- [ ] Run `/context-update 34`
- [ ] Commit on `feat/phase-34`; tag `v0.34.0` after merge
