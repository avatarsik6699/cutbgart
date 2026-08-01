---
name: phase-init
description: Scaffold a new PHASE_XX.md from PHASE_TEMPLATE.md. Fills metadata, scope, Contracts, and Files by extracting data from SPEC.md. Adds the phase row to STATE.md.
---

<!-- Migrated and adapted from the matching Claude Code skill. -->

You are running the SDD `phase-init` workflow.

**Target phase**: the arguments supplied in the user's request

Execute the canonical playbook in [docs/playbooks/phase-init.md](../../../docs/playbooks/phase-init.md). That file is the source of truth for all steps, inputs, rules, and the final report format.

If `the arguments supplied in the user's request` is empty, ask: "Which phase number? Usage: $phase-init 02".
