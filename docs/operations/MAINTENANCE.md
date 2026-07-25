# Operations maintenance

The operator owns normal reviews; `operator-on-call` owns active SEV-1 response; the release
operator is the approved actor for production deployments and rollback. One person may fill these
roles at current scale, but every checklist records the acting identity.

| Cadence | Required work | Evidence |
|---|---|---|
| Every release | Verify attestation/digest, candidate and external smoke, release identity, bounded record, previous release and rollback readiness | GitHub deployment plus `.ops/releases/history` record |
| Daily | Encrypted operational backup, freshness check, Uptime Kuma app/CDN monitors | backup checksum/manifest and monitor history |
| Monthly | Dependency/CVE/license/model-source review, expiring exceptions, backup success/size trend, disk/resource trend | security workflow, model check and maintenance note |
| Quarterly | Disposable restore and previous-digest rollback; alert firing/resolved receipt; SLO/threshold review; security headers/model cache; one sampled desktop/mobile/accessibility pass | dated drill record with duration and result |
| Annual or material change | Threat model, legal/data contract, access inventory and accessibility review | approved review record |

Maintenance windows are announced before suppression, linked to a release/runbook, and have a fixed
end time. At completion, remove suppression and send one resolved test. A failed backup, alert test,
restore, rollback or release check is not converted to a warning; it blocks the corresponding
maintenance/release closure.

Retention:

- release records: last 10 JSON records; non-secret config snapshots: last 3;
- encrypted daily backups and checksums: 14 days; retain one manually selected quarter-end drill
  artifact for 12 months, then delete it;
- Nginx/container logs: three 10 MiB rotated files per container;
- GitHub license artifacts: 30 days; SBOM artifacts: 90 days;
- Uptime Kuma and Umami: rolling 90 days unless their configured database policy is shorter;
- drill notes: 12 months, containing only aggregate operational evidence.

Quarterly, verify that the stated retention matches each platform configuration. Do not broaden
backup scope to arbitrary VPS paths. Secret and certificate access is limited to the operator and
restoration session; rotate the backup passphrase annually and after suspected disclosure.
