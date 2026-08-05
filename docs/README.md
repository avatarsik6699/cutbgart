# Documentation map

This directory has a deliberately small active surface. If a document is not listed below, treat
it as supporting or historical material—not as an implementation contract.

## Active sources of truth

| Document | Purpose |
|----------|---------|
| [`SPEC.md`](./SPEC.md) | Compact approved product/system intent and phased roadmap |
| [`STATE.md`](./STATE.md) | Compact current runtime contract, phase status, blockers, and current decisions |
| [`ARCHITECTURE_V2.md`](./ARCHITECTURE_V2.md) | Target v2 domain, layers, runtime, stack, and migration |
| [`PHASE_43.md`](./PHASE_43.md) | Completed final public v2 cutover, legacy-removal, and pre-production readiness contract |
| [`PHASE_42.md`](./PHASE_42.md) | Completed v2 regression-closure and architect-accepted blocked readiness record |
| [`PHASE_40.md`](./PHASE_40.md) | Latest completed v1-faithful batch workspace migration contract |
| [`PHASE_41.md`](./PHASE_41.md) | Latest completed v1-faithful editor-tool workspace migration contract |
| [`PHASE_39.md`](./PHASE_39.md) | Completed v1-faithful single-image main-page UI migration contract |
| [`PHASE_38.md`](./PHASE_38.md) | Blocked cutover-readiness evidence; parity dispositions need review under the v1-UI preservation decision |
| [`PHASE_37.md`](./PHASE_37.md) | Completed v2 batch and multi-document workspace contract and acceptance record |
| [`PHASE_36.md`](./PHASE_36.md) | Latest completed v2 Background and Enhancements contract and acceptance record |
| [`PHASE_35.md`](./PHASE_35.md) | Latest completed v2 Magic Cutout contract and acceptance record |
| [`PHASE_34.md`](./PHASE_34.md) | Completed v2 Manual/history contract and acceptance record |
| [`PHASE_33.md`](./PHASE_33.md) | Latest completed v2 foundation contract and acceptance record |
| [`STACK.md`](./STACK.md) | Current/planned technologies, commands, gates, deployment |
| [`FRONTEND_CONVENTIONS.md`](./FRONTEND_CONVENTIONS.md) | Hard React/TypeScript/frontend requirements |
| [`KNOWN_GOTCHAS.md`](./KNOWN_GOTCHAS.md) | Recurring project-specific failure modes and fixes |
| [`design/DESIGN_SYSTEM.md`](./design/DESIGN_SYSTEM.md) | Current visual tokens and approved design baseline |

`PHASE_TEMPLATE.md` and `playbooks/` define the SDD workflow. `security/`, `operations/`, and
`runbooks/` remain active production-operational documentation.

## Current phase boundary

Phase 43 completed the final pre-production cutover with a `ready` report and unwaived gate: every
public/scenario editor route now uses v2, the superseded legacy workflow is removed, and rollback to
the previous immutable release is rehearsed. No implementation phase is active. Production
deployment remains a separate post-merge operator action.

## Archive

Historical phases, superseded plans, evaluations, audits, legal baselines, design evidence, and full
pre-compaction SPEC/STATE snapshots are indexed in
[`archive/README.md`](./archive/README.md). Archived material is retained for traceability and
research, but must not be used as current scope without an explicit SPEC/phase decision.
