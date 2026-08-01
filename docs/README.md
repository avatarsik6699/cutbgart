# Documentation map

This directory has a deliberately small active surface. If a document is not listed below, treat
it as supporting or historical material—not as an implementation contract.

## Active sources of truth

| Document | Purpose |
|----------|---------|
| [`SPEC.md`](./SPEC.md) | Compact approved product/system intent and phased roadmap |
| [`STATE.md`](./STATE.md) | Compact current runtime contract, phase status, blockers, and current decisions |
| [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) | Target v2 domain, layers, runtime, stack, and migration |
| [`PHASE_33.md`](./PHASE_33.md) | Only active implementation scope |
| [`STACK.md`](./STACK.md) | Current/planned technologies, commands, gates, deployment |
| [`FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md) | Hard React/TypeScript/frontend requirements |
| [`KNOWN_GOTCHAS.md`](./KNOWN_GOTCHAS.md) | Recurring project-specific failure modes and fixes |
| [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) | Current visual tokens and approved design baseline |

`PHASE_TEMPLATE.md` and `playbooks/` define the SDD workflow. `security/`, `operations/`, and
`runbooks/` remain active production-operational documentation.

## Evidence being produced now

`audits/` is reserved for evidence required by the active phase. Historical Phase-31/32 evidence
has moved to the archive.

## Archive

Historical phases, superseded plans, evaluations, audits, legal baselines, design evidence, and full
pre-compaction SPEC/STATE snapshots are indexed in
[`archive/README.md`](./archive/README.md). Archived material is retained for traceability and
research, but must not be used as current scope without an explicit SPEC/phase decision.
