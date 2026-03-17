# SageRead X — Architecture Map

SageRead X architecture overview.

## System Overview

This document describes the module structure, layering, and dependency rules for SageRead X.
It is the single source of truth for how the codebase is organized and should be kept up to date as the project evolves.

SageRead X is a pnpm workspace monorepo centered on a Tauri + React desktop reader (`packages/app`), with a React Native mobile client (`packages/mobile`) and shared domain/service contracts (`packages/shared`).

## Module Map

| Module | Path | Purpose |
|-|-|-|
| Desktop App | `packages/app/src` | Main React/Tauri frontend: pages, components, hooks, services, stores, and app-side AI tooling. |
| Tauri Runtime | `packages/app/src-tauri` | Rust runtime, native command handlers, plugin integration, and desktop packaging boundary. |
| Mobile App | `packages/mobile/src` | React Native UI and adapters for shared APIs on mobile. |
| Shared Contracts | `packages/shared/src` | Shared types and service client factories consumed by workspace apps. |
| App Tabs | `packages/app-tabs/src` | Reusable tab primitives used by desktop reader layouts. |
| Foliate Engine | `packages/foliate-js` | E-book parsing/rendering engine and format support utilities. |
| Ops Scripts | `scripts` | Local operational scripts (integration smoke, cache cleanup, harness verification). |
| CI Workflows | `.github/workflows` | Continuous integration and release automation workflows. |

## Layer Diagram

Dependency direction flows downward. A layer may only import from layers below it.

Layers (bottom to top): `types/contracts` -> `constants/config` -> `services/data-access` -> `state/hooks` -> `runtime/ui`

## Dependency Rules

- `packages/app/src/components` and `packages/app/src/pages` may depend on hooks, store, services, and types, but services/store must not import UI components.
- Tauri API calls must stay inside service/lib boundaries (`packages/app/src/services`, `packages/app/src/lib`) instead of scattered UI calls.
- `packages/shared/src` is a leaf shared module for app/mobile consumers and must not import from `packages/app` or `packages/mobile`.
- Cross-workspace dependencies should be declared via `workspace:*` and consumed through package entry points.
- `packages/app/src-tauri` is the native boundary; frontend integration must go through stable command contracts.
- Build artifacts (`dist/`, `test-results/`) are outputs and must not become import sources.

General principles:

- Lower layers MUST NOT import from higher layers.
- Shared types live in the `types` layer and are importable by all.
- Side effects (I/O, network, file system) belong in `service` or `runtime` layers only.
- Config is read once at startup and passed down; modules do not read env vars directly.

## What Doesn't Belong

Each directory has a clear scope. Do not place files outside that scope.

- `packages/app/src` — no desktop UI or app-state-unrelated files
- `packages/app/src-tauri` — no frontend-only view/state code
- `packages/mobile/src` — no desktop-only runtime or Tauri-only integrations
- `packages/shared/src` — no app-specific UI concerns or runtime side effects
- `packages/app-tabs/src` — no feature/business logic outside tab primitives
- `packages/foliate-js` — no product-specific app state/store code
- `scripts` — no product runtime source files
- `.github/workflows` — no environment secrets or hardcoded credentials

## Primary Language

This project is written primarily in **TypeScript**.

<!-- EVOLVE: Add new modules to the Module Map table as they are created -->
<!-- EVOLVE: Update the Layer Diagram if new layers are introduced -->
<!-- EVOLVE: Revise Dependency Rules when architectural boundaries change -->
