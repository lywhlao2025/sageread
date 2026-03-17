# 001. Adopt Harness Engineering for SageRead X

**Date:** 2026-03-17

**Status:** Proposed

## Context

SageRead X is a multi-package codebase (desktop app, mobile app, shared contracts, Rust runtime) with growing agent-assisted changes. Existing instruction files are partially customized but lack a synchronized architecture map, deterministic verification command, and standardized CI harness checks.

## Decision

Adopt the harness-engineering pattern for this repository:

- Standardize agent instruction surfaces (`CLAUDE.md`, `AGENTS.md`, `.github/copilot-instructions.md`) with synchronized commands and boundaries.
- Maintain a living `ARCHITECTURE.md` module map and dependency rules.
- Add a persistent harness verifier (`scripts/verify-harness.sh`) and CI workflow (`.github/workflows/agent-lint.yml`).
- Establish `docs/adr/` for architecture decisions and drift control.

## Consequences

### Easier

- Agents can execute consistent build/test/check flows with lower ambiguity.
- Cross-package ownership and dependency boundaries are documented.
- Harness drift can be detected automatically in local and CI runs.

### Harder

- Team must keep command references and module maps synchronized.
- Initial setup adds documentation and workflow maintenance overhead.

## Notes

This ADR starts as Proposed and should be moved to Accepted after one full release cycle confirms the harness process works without blocking productivity.
