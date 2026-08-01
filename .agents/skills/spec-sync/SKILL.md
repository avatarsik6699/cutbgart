---
name: spec-sync
description: Run when docs/SPEC.md has changed. Propagates the change to docs/STATE.md (Current Contract, Phase Status, Project Log) and affected PHASE_XX.md files following the SDD sync protocol. Prevents context drift.
---

<!-- Migrated and adapted from the matching Claude Code skill. -->

You are running the SDD `spec-sync` workflow.

**Change description**: the arguments supplied in the user's request

**Recent SPEC.md git history**:
`git log --oneline -5 -- docs/SPEC.md 2>/dev/null || echo "git log unavailable"` (run only when needed)

**SPEC.md diff**:
`git diff HEAD -- docs/SPEC.md 2>/dev/null || git diff HEAD~1 HEAD -- docs/SPEC.md 2>/dev/null || echo "No diff available — SPEC.md may already be committed"` (run only when needed)

Execute the canonical playbook in [docs/playbooks/spec-sync.md](../../../docs/playbooks/spec-sync.md). That file is the source of truth for all steps, the impact-analysis matrix, the CHANGELOG entry format, and the rules.

If `the arguments supplied in the user's request` is empty and no diff is available, ask the architect what changed before proceeding.
