# PHASE 2: Shared Contracts and Module Boundaries

## Shared Contract Layer
All modules now derive their interface definitions from `src/contracts/`.

## Module Boundaries
- `src/contracts/` contains shared interface definitions.
- `src/os/` contains Sovereign OS implementations.
- `src/axs/` contains Polyglot Terminal implementations.

## Manifest Specification
Manifests are located in `manifests/` and validated against `manifests/manifest.schema.json`.
