# Incident, degraded mode and status communication

## Severity and ownership

- **SEV-1:** public app down, model unavailable/corrupt, failed rollback, or confirmed active
  security/privacy impact. `operator-on-call` acknowledges immediately and escalates by the
  `alerts.json` route.
- **SEV-2:** certificate within 14 days, disk/memory pressure, stale/failed backup, or elevated 5xx
  while the primary flow remains available. Operator acknowledges within one business hour.

One incident has one owner and one deduplication key. Maintenance suppression must name the approved
activity and expire automatically.

## First response

1. Acknowledge, note UTC start time and freeze releases.
2. Run `docker compose ps` and `scripts/operations/host-health.sh`. Record counts/states only; do
   not copy request paths or raw environment/log dumps.
3. Run the release smoke from the current app container with the expected identity from
   `.ops/releases/current.env`.
4. If the incident began with a release, use `ROLLBACK.md`. If CDN-only, confirm immutable upstream
   fallback and run the range/integrity check before a model rollback.
5. For resource pressure, stop nonessential maintenance work first. Do not raise frozen limits
   during the incident without recording the reason.
6. After recovery, send a resolved notification, remove suppression and schedule a review.

## Degraded modes

- CDN unavailable but upstream works: status “model downloads may start more slowly”; keep the
  browser-only service available.
- WebGPU unavailable: WASM/lightweight fallback is expected; do not page unless completion falls
  below its reviewed threshold.
- Browser offline: cached verified model assets may work; never promise first-use offline
  processing.
- Heavy model faulty: roll back the model/release. Never hot-edit the manifest.
- VPS resource pressure: preserve app/nginx and monitoring; pause model sync, backup or other
  maintenance, then investigate bounded logs.

## Status templates

Initial:

> We are investigating degraded background-removal availability. Image processing remains in the
> browser. Next update by `<UTC time>`.

Update:

> The service is `<degraded/unavailable>`. We are `<rolling back/checking model delivery>`. No
> image content is included in operational monitoring. Next update by `<UTC time>`.

Resolved:

> Service checks have recovered and the verified release is healthy. We will review the incident
> and publish any relevant operational follow-up.

Never name a visitor, filename, source URL, prompt, image, token, internal host or secret. If a
public status channel is unavailable, use the approved Telegram/email channel and preserve the same
minimal content.

## Review

Within two business days, record timeline, detection, recovery duration, release digest, aggregate
impact, contributing controls and owned follow-ups. Any unresolved high-severity observation is
added unchecked to `docs/archive/phases/PHASE_23.md` Architect Review Notes and blocks phase closure.
