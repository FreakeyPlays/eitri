# Tools

Read this when choosing commands, adding dependencies, changing tooling, or investigating failed checks. The [root scripts](../../package.json), workspace scripts, and tool configs define the current commands. [Workflow](workflow.md) covers running Eitri and the release process; [AGENTS.md](../../AGENTS.md) contains the development safety rules.

## Vite+ and Bun

Use Vite+ (`vp`) as the entry point for installs, tasks, and local tools:

- `vp install` installs workspace dependencies.
- `vp add <package>` adds a dependency; run it in the workspace that owns the dependency. Reuse the root catalogs for centrally managed versions and `workspace:*` for internal packages.
- `vp run <task>` runs an existing task. Use `vp run @eitri/server#test`, for example, to target one workspace.

Keep `bun.lock` as the dependency lockfile. Prefer existing tasks over assembling a second command that bypasses their configuration or prerequisites.

**Package manager and runtime are separate.** Vite+ delegates package management to Bun here, but the root `devEngines.runtime` selects Node for managed tooling. `vp` is the toolchain entry point, not itself the application runtime. The server and several scripts explicitly run on Bun; preserve that runtime choice when calling them through `vp run`. See the [Vite+ command reference](https://github.com/voidzero-dev/vite-plus/blob/main/crates/vp_cli_snapshots/tests/cli_snapshots/fixtures/migration_check/snapshots/migration_check.md).

For new server and tooling code, prefer Bun APIs and the existing Bun types over adding Node-specific APIs or dependencies such as `@types/node`. If a needed capability has no suitable Bun equivalent, use Node and tell me what required it. Keep platform APIs in adapters: browser code and portable shared packages must remain independent of both Bun and Node.

## Formatting, linting, and types

Use `vp check` for the integrated checks configured in [vite.config.ts](../../vite.config.ts). Use the workspace type-check tasks for their additional compiler checks. Follow the existing Vite+ imports and configuration instead of adding parallel formatter or linter setups.

Scope automatic fixes to the files you are changing and review their diff. A passing formatter or linter does not establish that behavior is correct.

## Dependency Cruiser

[Dependency Cruiser](../../.dependency-cruiser.mjs) checks import boundaries, cycles, resolution, and dependency declarations. Run `vp run deps:check` after moving modules, changing package exports, or adding imports across boundaries.

Read the named rule and the offending dependency before fixing a failure. Correct the import, module placement, or dependency declaration. Change a rule only when the intended architecture has changed, and explain why. `vp run deps:graph` produces a Mermaid dependency diagram when a picture helps investigate the structure.

## Knip

[Knip](../../knip.jsonc) finds unused files, exports, and dependencies. Run `vp run knip` after removing or moving code, changing entry points, or editing dependencies. `vp run knip:production` provides the production-only view.

Check whether a reported item is actually unused or reached through framework configuration, generated code, or a tool entry point. Remove dead code; model real entry points in the config. Keep necessary exclusions narrow and explain them instead of suppressing findings broadly.

## Varlock

[.env.schema](../../.env.schema) defines environment configuration, including environment selection, sensitivity, and Bitwarden integration. Add configuration definitions there when extending this setup; keep real credentials out of tracked files and command output.

Varlock and its Bitwarden plugin are installed, but the current package scripts and CI do not invoke Varlock. Schema annotations alone do not establish runtime validation, redaction, or leak prevention. When a task relies on those features, verify the actual loading path before claiming they are active.

## Tests and Stryker

Use the owning workspace's test task: the server uses Bun tests, while the client and packages use Vitest. The client's `unit` project in [vite.config.ts](../../apps/client/vite.config.ts) compiles Angular through Analog's plugin; its `storybook` project holds the visual tests. Choose tests that exercise the changed behavior.

Stryker checks whether tests detect deliberate code changes. Run `vp run test:mutation` when assessing test strength or when the full validation workflow requires it. [stryker.config.json](../../stryker.config.json) mutates client, server, and package runtime source in one run. Its command runner invokes `vp run test`, preserving the server's Bun runtime and the client's Angular setup. Every mutant reruns the full workspace unit suite; per-test coverage selection is unavailable with the command runner. Visual tests are excluded. The mutation score and threshold apply to the combined codebase. CI runs it on a weekly schedule rather than on pull requests. The HTML report is written to `reports/mutation/index.html`.

Investigate surviving mutants for missing behavioral assertions or equivalent behavior. Strengthen meaningful tests rather than lowering thresholds to make the run pass. Keep each config's `mutate` scope aligned with the tests its runner executes.

Visual tests and baseline updates have separate tasks. Follow the browser-verification permission rule in AGENTS.md before running them, and review differences before accepting new baselines. Baselines are rendered on macOS; when CI renders differently, its `storybook-visual-differences` artifact holds the results to review.

## Choosing validation

Start with checks relevant to the change, then use the broader validation described in [Workflow](workflow.md). `ready` does not include the test suites; `ready:full` includes native, mutation, and visual checks as well.

For documentation-only changes, check formatting, links, and command accuracy. When reporting completion, state which checks ran and identify any failures or checks that could not run. Keep unrelated failures separate from the change without presenting them as a clean pass.
