# Phase 38 cutover-readiness results

Date: 2026-08-04

Schema: `phase-38.readiness.v1`
Conclusion: **blocked**

The isolated v2 workflow is not yet eligible for public cutover. Automated accessibility and the
complete deterministic journey are green, the serialized host real-model journey is green, and the
managed Windows product sample completed without an editor failure. Readiness still fails closed on
missing product capabilities and unsupported evidence listed below. The architect accepted this
conclusion and the iterative v1-faithful migration direction. Public/scenario routes remain
unchanged.

## Verified defects closed inside Phase-33–37 contracts

- Added semantic localized progressbar state instead of a visual-only progress strip.
- Restored focus into Manual/Magic workspaces and back to their persistent launcher on close.
- Added initial focus, Escape handling, Tab containment, modal semantics, and passing destructive
  contrast to the Magic discard alertdialog.
- Made the horizontal contact sheet and Manual canvas viewport named, keyboard-focusable scroll
  regions; increased small retry/remove targets to the WCAG 2.2 minimum.
- Added equivalent Russian/English shortcut discoverability; all 442 message keys align.
- Scanner exclusions: none. Final additive WCAG tag scans reported zero violations in both locales
  across the material-state matrix.

These fixes changed presentation semantics only. No domain command/event, actor, artifact, model,
persistence, privacy, route, or public API contract changed.

## Evidence

- Deterministic Chromium: two zero-retry tests passed in 13.7 seconds. The accessibility test scans
  empty, processing, multi-result, Manual, Magic/dialog, Background, Enhancement, validation-error,
  export, reduced-motion, narrow, and effective-200%-reflow states in both locales. The full journey
  covers three documents, every tool, history, isolated Enhancement failure/retry, selected PNG,
  ZIP, privacy-neutral entries, and three repeated cleanup cycles. Observed application Long Task
  maximum after hydration was `0 ms`; final resources were `0/0/0`.
- Final full deterministic regression: 101 passed with 3 intentional model-lab skips and zero
  retries. The gate also passed the focused Phase-38 deterministic and real-model journeys.
- Host real-model Chromium: passed once, serially, with zero retries in 37.7 seconds. Two cold/warm
  documents produced exactly two automatic runs; Manual, one real Magic prediction, Background,
  at least one real Enhancement stage, cached selection, ZIP, and `0/0/0` cleanup completed.
- Managed Windows Playwright: WSL UNC upload produced two real results. Manual focus restoration,
  centered narrow-pointer Magic, keyboard Background Apply, Enhancement, selection, and ZIP passed.
  Selection retained exactly `9` artifacts, `27` leases, and `5` object URLs before/after; 360px
  layout measured document width `346` against viewport `361`; cleanup ended `0/0/0`.
- Performance/resource verifier: three versioned runs pass hard ownership/admission checks and
  evaluate `inconclusive` rather than passing because timing signals below are unsupported.

## Cutover blockers

- `INPUT-02`, `INPUT-03`: v2 lacks the legacy drop and clipboard input capabilities. Phase 38 is
  validation-only and did not add them.
- `LEGACY-01`, `LEGACY-02`, `LEGACY-03`: quality/model choice, export-size choice, and the remaining
  visible v1 control catalog are required public-UI outcomes that v2 does not yet reproduce.
- `RESP-01`: managed Windows browser zoom shortcuts did not alter zoom state. The automated
  320-effective-pixel sample passed, but it cannot substitute for actual Windows 200% zoom.
- `A11Y-01`, `A11Y-03`, `A11Y-04`, `COPY-01`: automated and Windows samples passed their captured
  signals, but final architect keyboard/announcement/touch/copy acceptance is absent.
- Phase-38 performance is inconclusive: per-document cold/warm timestamps and Windows Long Task
  entries were not captured. Unsupported signals are not represented as zero.

`/phase-gate 38` passed on 2026-08-04, including the full deterministic suite, serialized real-model
journey, production/container/release smoke checks, supply-chain scans, and review-note check. This
closes the validation phase; it does not change the blocked public-cutover conclusion.

There are no unresolved automated serious/critical accessibility findings after the fixes. The
blockers above are evidence/product decisions or separately scoped capabilities, not hidden defects
inside the accepted Phase-33–37 contracts.

## Environment limitations

- Managed target evidence is Windows Playwright MCP; host real-model evidence is WSL/Linux Chromium.
  They are identified separately and never substituted for one another.
- Browser/OS/GPU version strings were not exposed by the managed tool in this run and are recorded
  as unsupported rather than inferred.
- Local analytics emitted the known `cutbg.art/script.js` CSP and Cloudflare RUM CORS noise. No
  editor exception, failed model request, lost command, or stale publication was observed.
- The Windows MCP could not instrument worker messages before navigation, so exact Windows automatic
  and Enhancement run counts are unsupported; host real-model and deterministic counts are exact.

## Required follow-up before a new readiness run

1. Reproduce the required quality/model, export-size, and remaining visible v1 controls through
   separately scoped v1-faithful UI slices.
2. Add required drop/paste behavior through the approved main-page migration slice.
3. Repeat actual Windows 200% zoom and architect keyboard/touch/copy review on the affected device.
4. Capture per-document cold/warm and Windows Long Task evidence, then run a new cutover-readiness
   validation after the product blockers are closed.
