---
name: context-update
description: Update docs/STATE.md after a phase is completed. Reads the phase Contracts section and updates the Current Contract, Phase Status, and Project Log.
---

<!-- Migrated and adapted from the matching Claude Code skill. -->

You are running the SDD `context-update` workflow.

**Target phase**: the arguments supplied in the user's request

Execute the canonical playbook in [docs/playbooks/context-update.md](../../../docs/playbooks/context-update.md). That file is the source of truth for all steps, the version-bump rules, and the final report format.

Do not commit — the architect reviews and commits.
