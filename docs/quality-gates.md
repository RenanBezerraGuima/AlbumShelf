# Quality Gates

This repository enforces behavior-focused quality gates for pull requests.

## Local Commands

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test:coverage`
- `pnpm test:perf`
- `pnpm test:e2e:smoke`
- `pnpm quality:ci`

## Coverage Policy

- Test runner: Vitest with V8 coverage.
- Global thresholds:
  - Lines: `80%`
  - Functions: `80%`
  - Branches: `70%`
  - Statements: `80%`
- Current scope is focused on behavior-critical modules first (core services, orchestration flows, and covered interaction surfaces).
- Some large presentation-heavy modules are temporarily excluded and are tracked for later coverage waves.
- New behavior changes must include automated tests (unit/integration/E2E) with at least one happy path and one edge/failure path.

## Performance Policy

`pnpm test:perf` runs deterministic regression checks for:

- Tree traversal hotspots (`findFolder`, `getBreadcrumb`).
- Share payload compression/decompression throughput.

Budgets are intentionally conservative for shared CI runners and should only be tightened after collecting baseline history.

## CI Pipeline

Workflow: `.github/workflows/quality.yml`

- Runs lint + typecheck + coverage + perf checks when application code changes.
- Runs E2E smoke checks only for changes that affect UI/E2E paths.
- Uses path-based filtering and caching to keep pull request runtime fast.

## Failure Handling

When any gate fails:

1. Reproduce the failure locally with the same command.
2. For bugs: add or update a failing regression test first.
3. Apply fix and rerun all affected gates.
4. Document remaining risk explicitly in the PR description if a gate is intentionally deferred.
