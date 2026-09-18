# Development and release workflow

Read this when planning a feature, preparing a change for review, or releasing.
Follow [AGENTS.md](../../AGENTS.md) for repository constraints.

## Develop a change

1. **Define the outcome.** For a feature, copy the
   [feature template](../features/000_example.md) into `docs/features/` with a
   descriptive name. Record the user problem, observable behavior, exclusions,
   and completion criteria. Mark proposals and unresolved questions explicitly;
   use `ready` once implementation-blocking choices are settled. Small fixes can
   keep this context in the task or PR instead.
2. **Implement the agreed scope.** Use the [README](../../README.md#local-development)
   to run Eitri and [architecture](architecture.md) when changing boundaries.
   The change is ready for validation when its completion criteria are implemented.
3. **Validate.** Run checks relevant to the change. For code changes, run `ready`
   and relevant tests; `ready` alone does not run tests. For documentation changes,
   check formatting, local links, and claims against the source. Report what passed,
   failed, or could not run. Consult [tools](tools.md) for check selection and
   [AGENTS.md](../../AGENTS.md) before browser or visual verification.
4. **Prepare for review.** Update affected docs to match the resulting behavior
   and retain decisions and evidence in the feature document. Remove disposable
   plan notes only after transferring lasting knowledge. Open a PR describing the
   outcome and validation, using a Conventional Commit title.

## Automation and releases

[CI](../../.github/workflows/ci.yml) defines the automated checks. Review the
results and complete review before merging. For full local validation, the
[root scripts](../../package.json) define `ready:full`; it includes native,
mutation, and visual checks. [Mutation CI](../../.github/workflows/mutation.yml)
runs weekly and on demand rather than on each PR.

After successful CI on `main`, [release automation](../../.github/workflows/release.yml)
creates or updates a draft version PR when releasable changes exist. Merging that
PR triggers CI and publication of a universal macOS DMG. Consult the workflow and
[versioning script](../../scripts/release.ts) when changing or troubleshooting releases.

The release PR uses `GITHUB_TOKEN`, so its creation does not trigger PR checks.
Repository settings must allow GitHub Actions to create pull requests. Release
publication follows CI success; the separate
[dependency scan](../../.github/workflows/osv-scanner.yml) does not gate it.
