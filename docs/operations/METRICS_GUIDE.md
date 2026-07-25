# Metrics and operational signals guide

This is the owner-facing index for every Phase-23 signal. Threshold definitions live in
`RELIABILITY.md` and `alerts.json`; this guide explains how to reach the evidence safely. Never
copy image data, filenames, prompts, source URLs, secrets or raw environment files into a metric,
alert or incident note.

## Signal map

| Signal | Meaning / expected threshold | View and safe access | Storage / retention |
|---|---|---|---|
| Uptime Kuma public SSR | `/` and `/en` synthetic success; ≥99.0% monthly, alert after two failures | SSH tunnel below, then **Status → monitor → Heartbeats** | `uptime-kuma-data`; rolling 90 days |
| Uptime Kuma CDN/model | 1-byte range/readiness; ≥99.5%, alert after two failures | Tunnel, then CDN monitor heartbeats; integrity is confirmed by release smoke | `uptime-kuma-data`; rolling 90 days |
| Umami processing | `processing_completed / processing_started`; observe ≥90% after baseline | Tunnel or the existing private Umami access path; **Events**, weekly date range | `umami-db-data`; rolling 90 days |
| Umami download proxy | `download_clicked / processing_completed`; investigate ≥20% relative weekly drop | Umami **Events** with identical date filters | `umami-db-data`; rolling 90 days |
| Cloudflare Web Vitals | Aggregate p75 LCP/INP/CLS; 2.5 s / 200 ms / 0.1 | Cloudflare dashboard → account → site → Web Analytics → Core Web Vitals; use aggregate view only | Cloudflare-managed aggregate retention; verify quarterly |
| GitHub CI/release | Checks, actor, ref, immutable SHA/digest, candidate/post result | Repository **Actions → CI → run** and **Environments → production** | GitHub run/deployment retention |
| GHCR/attestation | Image digest, OCI labels, provenance and SBOM identity | Repository **Packages**, or `gh attestation verify oci://<image>@sha256:<digest> --repo <owner/repo>` | GHCR package plus 90-day uploaded SBOM |
| VPS release/rollback | Last 10 deploy/rollback outcomes and last three config snapshots | SSH, then `cd <app-dir>` and `find .ops/releases -maxdepth 2 -type f -print`; read JSON only | `.ops/releases`, bounded 10/3 |
| VPS container health/logs | Running/healthy state, bounded errors and resource pressure | `docker compose ps`; `docker compose logs --since 15m <service>`; do not paste request lines | Docker JSON logs, 3 × 10 MiB per container |
| Backup/restore | Latest encrypted artifact, checksum, drill result; fresh <30 h | `find <backup-dir> -maxdepth 1 -type f -name 'operations-*' -print`; use backup runbook | encrypted daily files 14 days; quarter-end drill 12 months |
| Release success/rollback time | Successful releases/attempts ≥95%; previous digest healthy ≤15 min | GitHub deployment plus matching VPS release record timestamps | GitHub plus last 10 VPS records |
| Elevated 5xx | Fewer than 10 proxy 5xx in five minutes | `scripts/operations/host-health.sh` prints count only | rotated Nginx logs; alert dedup 30 min |
| Certificate expiry | More than 14 days remaining | host-health output and Uptime Kuma certificate monitor | monitor history 90 days |
| Disk/memory | disk <80%, memory <85% sustained | host-health output; `docker stats --no-stream` for live triage | aggregate drill/incident note 12 months |
| Capacity exercise | 20 SSR + 4 range probes, zero failures, SSR p95 ≤2 s | `node scripts/operations/exercise-capacity.mjs`; output is aggregate JSON | dated quarterly drill note 12 months |

Cloudflare and GitHub retention can change by account plan. The quarterly owner review records the
actual UI value; this repository does not claim a longer platform retention than the account shows.

## Uptime Kuma through an SSH tunnel

1. Start a local-only tunnel from a trusted workstation:

   ```bash
   ssh -N -L 127.0.0.1:3001:127.0.0.1:3001 <vps-user>@<vps-host>
   ```

2. Leave that terminal running and open `http://127.0.0.1:3001/`. Sign in with the Uptime Kuma
   credential from the approved password manager; never place it in the command.
3. Verify the tunnel without authenticating:

   ```bash
   curl -I http://127.0.0.1:3001/
   ```

   An HTTP response proves the port forwards; it does not prove monitor correctness. In the
   dashboard, verify the expected app, CDN/model and certificate monitors and their latest
   heartbeat.
4. Stop the tunnel with `Ctrl-C` in the SSH terminal. Confirm shutdown with
   `curl -I http://127.0.0.1:3001/`; it should fail to connect.

Troubleshooting:

- `bind: Address already in use`: choose an unused local port, for example
  `-L 127.0.0.1:13001:127.0.0.1:3001`, then browse `http://127.0.0.1:13001/`;
- SSH authentication failure: repair approved SSH access; do not expose port 3001 publicly;
- tunnel works but the page fails: on the VPS run `docker compose ps uptime-kuma` and inspect only
  bounded Uptime Kuma logs;
- missing monitor: configure it from `alerts.json` and `RELIABILITY.md`, then send firing and
  resolved tests before relying on it.

## Release and recovery access

Use `docs/runbooks/DEPLOY.md` and `ROLLBACK.md`; do not run raw `docker compose up` for production.
The release controller is the authority for the digest, lock, candidate, identity and record.
Backups are never opened in place: checksum and decrypt them into a new disposable directory with
`BACKUP_RESTORE.md`. Access to GitHub production secrets, the backup passphrase and certificate
material is restricted to the operator; values are never committed or copied into evidence.
