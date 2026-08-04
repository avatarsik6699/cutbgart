# Phase 37 implementation results

Date: 2026-08-03

- Deterministic Chromium: three-document FIFO, unselected progress, draft restore, mixed invalid
  add/remove, keyboard selection, guarded removal, neutral deterministic ZIP names, and `0/0/0`
  resource cleanup passed with zero retries.
- Host real model: three documents completed serially; exact automatic `RUN` count stayed at three
  across cached selection; ZIP and `0/0/0` cleanup passed. Instrumented smoke duration was 36.0
  seconds.
- Windows Playwright MCP: WSL app and UNC fixture upload worked; three results completed. Artifact,
  lease, and URL counts stayed `9/21/6` across selection, the dirty Background draft restored,
  Download All produced `cutbg-results.zip`, scrolling remained responsive, and churn ended at
  `0/0/0`.
- Windows MCP cannot retroactively instrument `Worker.prototype.postMessage`; exact Windows RUN
  counts are therefore recorded as unsupported rather than inferred from host data.
- Local analytics produced the pre-existing CSP/CORS console noise for `cutbg.art/script.js` and
  Cloudflare RUM. No editor exception or failed model request was observed.

Versioned machine-readable evidence is in `PHASE_37_REPORTS.json`.

## Gate outcome

The complete repository and Phase-37 gate passed on 2026-08-04 after updating the Phase-34/35
regression scenarios for persisted per-document tool settings and the new document-removal
accessible name. Production and disposable-release builds/smokes, type-check, lint, 635 unit and
component tests, architecture lint, the full mocked Chromium suite, generic and Phase-37 real-model
smokes, Phase-37 report verification, dependency/license/model checks, and SHA-pinned Trivy
filesystem/image scans were green. The production dependency audit reported one moderate advisory
and no HIGH/CRITICAL finding. All Architect Review Notes are resolved.
