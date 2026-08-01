---
name: phase-gate
description: Run all gate checks for the current phase before committing. Executes the sequence declared in docs/STACK.md#gate-commands plus the phase's Gate Checks, then verifies architect review notes. Reports PASS or FAIL.
---

<!-- Migrated and adapted from the matching Claude Code skill. -->

You are running the SDD `phase-gate` workflow.

**Target phase**: the arguments supplied in the user's request

Execute the canonical playbook in [docs/playbooks/phase-gate.md](../../../docs/playbooks/phase-gate.md). The executable commands live in `docs/STACK.md#gate-commands`; do not duplicate them here.

Read-only: do not edit code, do not commit.

If `the arguments supplied in the user's request` is empty and `docs/STATE.md` has no `🔄 in-progress` phase, ask: "Which phase number should I check? (e.g. $phase-gate 01)"
