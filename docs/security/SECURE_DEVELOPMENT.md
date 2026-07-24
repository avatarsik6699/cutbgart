# Secure Development and Supply Chain Policy

This policy implements the NIST SSDF practices relevant to the browser-only
cutbg delivery chain. The maintainer owns all exceptions and incident actions.

## Reviewed production inputs

- `pnpm-lock.yaml` is reviewed like source. CI installs with
  `pnpm install --frozen-lockfile`; unexplained lockfile churn is rejected.
- Docker base/service images use `tag@sha256:digest`. Digests are refreshed
  deliberately after upstream release notes and licenses are reviewed.
- GitHub Actions use a full 40-character commit SHA with the audited release
  tag in a comment. Mutable tags are forbidden.
- `models.manifest.json` is the model/WASM lockfile. Every entry has an
  immutable revision, exact decoded byte size and SHA-256. Binary assets are
  never committed.

## Update windows and failure policy

| Finding | Required action |
|---|---|
| Known exploited, active compromise, leaked credential or critical reachable vulnerability | Freeze release/deploy immediately; mitigate or roll back within 24 hours |
| High reachable production vulnerability | Remediate within 7 days |
| Moderate vulnerability | Triage within 14 days; remediate within 30 days |
| Low/unreachable finding | Record rationale and include in the next monthly maintenance review |
| Base image, action, package or model update without a vulnerability | Review monthly; do not update blindly |

CI fails on newly introduced high/critical dependency or container findings,
scanner errors, disallowed/unknown production licenses, manifest mismatch,
mutable Actions/production images, or a missing SBOM/attestation. Unfixed
findings are not silently ignored.

## Scanners frozen for v0.22.0

- PR dependency and license diff:
  `actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294`
  (v5.0.0), severity `high`, runtime and development scopes.
- Repository and container:
  `aquasecurity/trivy-action@ed142fd0673e97e23eac54620cfb913e5ce36c25`
  (v0.36.0 / Trivy 0.70.0), `HIGH,CRITICAL`, `exit-code: 1`. Findings
  without an upstream fix are still reported and fail until a time-boxed,
  owned exception is recorded.
- Package audit: `pnpm audit --prod --audit-level high`.
- License inventory: `pnpm licenses list --prod --json`; enforcement:
  `pnpm security:licenses`. The allow-list covers the reviewed current tree.
  LGPL libvips and MPL Lightning CSS are build-time transitive tools and are
  not copied into the self-contained runtime image; their notices/source terms
  still remain review requirements. New/unknown expressions fail.
- SBOM: Trivy CycloneDX JSON for the pushed image digest. GitHub
  `actions/attest` binds both provenance and the SBOM to that digest.

The Trivy action is pinned to the post-incident v0.36.0 commit reviewed after
the March 2026 upstream credential compromise. A future scanner bump must
repeat provenance/release review; never repoint the SHA without review.

## Exceptions

An exception must be recorded in `docs/STATE.md` Project Log before merge with:
finding/license, exact version/digest, reachability, compensating control,
maintainer as owner, expiry no later than 30 days, and removal issue. Expired
or unowned exceptions fail the release. There are no v0.22.0 exceptions.

## License and model review

Before adding a production dependency/model: confirm the upstream owner,
license, redistribution permission, immutable source revision, expected files,
browser-only data flow and rollback path. Do not ship weights or code with an
unknown or incompatible license.

## Emergency compromise procedure

1. Stop protected-environment deploys and preserve relevant workflow/VPS logs
   without copying user data.
2. Revoke affected GitHub/VPS/registry credentials and invalidate sessions.
3. Pin back to the last reviewed lockfile, action SHA, image digest or
   `model-assets.previous`; block the compromised input at Cloudflare/Nginx if
   necessary.
4. Rebuild on a clean GitHub-hosted runner, regenerate SBOM/provenance, verify
   repository/workflow/ref and deploy by digest.
5. Follow `docs/runbooks/VULNERABILITY_RESPONSE.md`, then document cause and
   prevention in `docs/KNOWN_GOTCHAS.md` or the Project Log.
