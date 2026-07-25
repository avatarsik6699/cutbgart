# Operational backup and restore

## Contract

RPO is 24 hours and RTO is 4 hours for Umami/Uptime history, release/config metadata and encrypted
TLS material. These cost-appropriate targets reflect non-transactional operational data on one VPS;
the public image-processing flow has no server-side user state to recover. Daily encrypted backups
are retained 14 days; one quarter-end drill artifact may be retained 12 months.

Never back up source images, filenames, masks, composites, prompts, editor state, arbitrary home
directories, `.env` files or unreviewed VPS paths. The encryption passphrase is stored in the
approved password/secret store, readable only by the operator, rotated annually and after suspected
disclosure.

## Create

Write a passphrase to a mode-600 temporary/managed file without printing it, then:

```bash
export BACKUP_PASSPHRASE_FILE='<absolute-passphrase-file>'
export BACKUP_DIR='<absolute-backup-directory>'
./scripts/operations/backup.sh
```

The script uses an exact allowlist, AES-256-CBC with PBKDF2 and salt, writes a SHA-256 sidecar, and
deletes only matching backup artifacts older than the configured retention. Copy the encrypted
artifact and checksum to the approved off-host encrypted storage. A nonzero exit or no artifact
within 30 hours triggers `backup-failure`.

## Disposable restore drill

Use a new empty directory:

```bash
export BACKUP_PASSPHRASE_FILE='<absolute-passphrase-file>'
./scripts/operations/restore.sh \
  '<backup-dir>/operations-<timestamp>.tar.gz.enc' \
  '<new-empty-restore-directory>'
```

Confirm checksum, manifest, expected operational files and absence of prohibited content. Record
start/end UTC time, artifact date, pass/fail and aggregate size only. Delete the decrypted drill
directory securely according to host policy after evidence is recorded.

## Apply to recovery services

Only during an approved restore window, after taking a fresh backup:

```bash
export RESTORE_APPLY=1
export RESTORE_CONFIRM='restore-operational-state'
./scripts/operations/restore.sh '<encrypted-archive>' '<new-empty-staging-directory>'
```

This replaces the selected Umami, Uptime Kuma and certificate state; it does not touch application
images or release source. Afterward start the stack, run `host-health.sh`, verify Uptime monitors
through the documented SSH tunnel, test one firing/resolved notification, and run the external
release smoke. If recovery exceeds 4 hours, record an RTO miss and open a follow-up.
