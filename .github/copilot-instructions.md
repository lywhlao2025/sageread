# Copilot Instructions — SageRead X

<!-- Keep in sync with CLAUDE.md and AGENTS.md -->

SageRead X is a React + Tauri monorepo project in TypeScript.

## Commands

- **Build:** `pnpm --filter app build`
- **Test:** `pnpm --filter app test`
- **Lint:** `pnpm --filter app typecheck`
- **Format:** `echo "No repository-wide formatter gate configured; run biome format on touched files"`
- **Check (all):** `pnpm run check`
- **Verify harness:** `pnpm run verify`

```bash
pnpm --filter app build
pnpm --filter app test
pnpm --filter app typecheck
pnpm run check
pnpm run verify
```

## Architecture

Workspace modules are split into desktop UI/runtime (`packages/app` + `packages/app/src-tauri`), mobile UI (`packages/mobile`), and shared contracts (`packages/shared`) with explicit workspace dependencies.

Full details: [ARCHITECTURE.md](../ARCHITECTURE.md)

Key modules:

- **Desktop App** (`packages/app/src`) — React pages/components/services/store for the main app.
- **Tauri Runtime** (`packages/app/src-tauri`) — Rust-native runtime commands and desktop integration.
- **Mobile App** (`packages/mobile/src`) — React Native app implementation.
- **Shared Contracts** (`packages/shared/src`) — reusable types and API/service adapters.
- **App Tabs** (`packages/app-tabs/src`) — tab library consumed by app UI.
- **Foliate Engine** (`packages/foliate-js`) — e-book parsing/rendering engine.

## Conventions

- Keep changes scoped to the target package and module.
- Prefer TypeScript explicit types over `any`.
- Keep UI logic in components/hooks and side effects in services/lib.
- Keep test files colocated in `__tests__` when extending existing patterns.
- Preserve existing Chinese/English docs and comments where already present.

## Always

- Run `pnpm run check` before considering a task complete.
- Update `ARCHITECTURE.md` when adding or moving top-level modules.
- Keep commands synchronized across `CLAUDE.md`, `AGENTS.md`, and this file.
- Do not skip pre-commit hooks.

## Never

- Do not add new dependencies without explicit approval.
- Do not bypass tests/verification when changing behavior.
- Do not move Tauri/native logic into UI component files.
- Do not commit secrets or workflow tokens.

## Ask

- Cross-package API contract changes (`packages/shared` consumers).
- CI/release workflow behavior changes.
- Database/schema or persistent-storage migration logic.
- Refactors that span multiple workspace packages.

## Maintenance Rules

When making changes, keep the project harness in sync:

1. New module -> update `ARCHITECTURE.md` module table.
2. New command -> update Commands in `CLAUDE.md`, `AGENTS.md`, and this file.
3. Agent error -> add a rule to the appropriate Boundaries section.
4. Architecture decision -> create ADR in `docs/adr/`.
5. Start of session -> verify `ARCHITECTURE.md` matches reality.
