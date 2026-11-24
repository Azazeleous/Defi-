# Phase 2: Migration Guide — v6.1.0 to v6.2.0

## 1. Migration Scope
This guide outlines the transition of the CRYPTIC Device Mesh from monolithic ad-hoc type declarations to the modular contract layer established in v6.2.0.

## 2. Breaking Changes & Deprecations
- **Contracts Centralization**: Standalone types previously scattered in `src/types/` are migrated to canonical definitions in `src/contracts/index.ts` and `src/contracts/dualtrace.ts`.
- **Operator Token Precedence**: Reverse redirection token `<--` must be parsed ahead of `<` or `>` to prevent token truncation.
- **Sparsebundle Verification**: Block ledger operations now mandate pre-flight checksum evaluation via `verifySparsebundleIntegrity()`.

## 3. Migration Checklist
1. Ensure all new modules supply valid manifests in `/manifests/` matching `manifest.schema.json`.
2. Reference interfaces from `src/os/interfaces/` and `src/axs/interfaces/` rather than internal module paths.
3. Validate that four-lane lattice cycles retain both forward and backward ticket provenance to ensure zero un-tracked execution vectors.
