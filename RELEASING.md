# Releasing

Releases are automated with [Changesets](https://github.com/changesets/changesets) and published to npm via [trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub Actions OIDC). No npm token exists anywhere — not in repo secrets, not on a maintainer's machine.

## One-time setup (not yet done)

The workflows in `.github/workflows/` are ready, but publishing needs two pieces of external configuration before the first release:

1. **npm trusted publishers**: on npmjs.com, configure the `placement` and `@placement/vue` packages with a trusted publisher pointing at this repository's `release.yml` workflow and the `release` environment.
2. **GitHub `release` environment**: create an environment named `release` in the repository settings with a required reviewer, so publishes wait for explicit approval.

## Day-to-day flow

1. Land PRs with changeset files as usual (`pnpm changeset`).
2. On every push to `main`, the release workflow updates the **Version Packages** PR, which accumulates pending changesets into version bumps and changelogs for both packages.
3. Merging that PR puts unpublished versions on `main`. The workflow detects this and queues the `publish` job against the `release` environment, which waits for reviewer approval.
4. Approve the deployment. The job re-runs lint, build, tests, and typecheck on the exact tree being published, then `changeset publish` publishes with provenance, pushes the `placement@x.y.z` / `@placement/vue@x.y.z` git tags, and creates the GitHub Releases.

Pushes to `main` that leave nothing to publish (the current versions are already on npm, or changesets are still pending) never request approval.
