# Documentation map

This directory has a deliberately small active surface. If a document is not listed below, treat
it as supporting or historical material—not as an implementation contract.

## Active sources of truth

| Document | Purpose |
|----------|---------|
| [`SPEC.md`](./SPEC.md) | Compact approved product/system intent and phased roadmap |
| [`STATE.md`](./STATE.md) | Compact current runtime contract, phase status, blockers, and current decisions |
| [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) | Target v2 domain, layers, runtime, stack, and migration |
| [`PHASE_44.md`](./PHASE_44.md) | Active checkpoint-driven frontend decomposition and render-ownership contract |
| [`STACK.md`](./STACK.md) | Current/planned technologies, commands, gates, deployment |
| [`FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md) | Hard React/TypeScript/frontend requirements |
| [`KNOWN_GOTCHAS.md`](./KNOWN_GOTCHAS.md) | Recurring project-specific failure modes and fixes |
| [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) | Current visual tokens and approved design baseline |

`PHASE_TEMPLATE.md` and `playbooks/` define the SDD workflow. `security/`, `operations/`, and
`runbooks/` remain active production-operational documentation.

## Current phase boundary

Phase 44 is the only active implementation scope. It refactors the accepted Phase-43 public
frontend through architect-approved checkpoints in order `T2` through `T8`, followed by final
evidence and gate task `T1`. Production deployment remains a separate post-merge operator action.

## Archive

Historical phases, superseded plans, evaluations, audits, legal baselines, design evidence, and full
pre-compaction SPEC/STATE snapshots are indexed in
[`archive/README.md`](./archive/README.md). Archived material is retained for traceability and
research, but must not be used as current scope without an explicit SPEC/phase decision.
