# Releasing

[Changesets](https://github.com/changesets/changesets) automates releases, and GitHub Actions publishes them to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers) (GitHub Actions OIDC). No npm token exists in the repo secrets, on the machine of a maintainer, or anywhere else.

## One-time setup (not yet done)

The workflows in `.github/workflows/` are ready, but publishing needs two pieces of external configuration before the first release:

1. On npmjs.com, configure a trusted publisher for the `placement` and `@placement/vue` packages. Point it at the `release.yml` workflow of this repository and the `release` environment.
2. In the repository settings, create an environment named `release` with a required reviewer, so that each publish waits for explicit approval.

## Day-to-day flow

1. Merge PRs with changeset files as usual (`pnpm changeset`).
2. On every push to `main`, the release workflow updates the "Version Packages" PR. This PR collects the pending changesets into version bumps and changelogs for both packages.
3. When you merge that PR, `main` has versions that are not published yet. The workflow detects this and queues the `publish` job against the `release` environment. The job waits for reviewer approval.
4. Approve the deployment. The job runs lint, build, tests, and typecheck again on the exact tree that it publishes. Then `changeset publish` publishes with provenance, pushes the `placement@x.y.z` and `@placement/vue@x.y.z` git tags, and creates the GitHub Releases.

If a push to `main` leaves nothing to publish, the workflow never requests approval. This happens when the current versions are already on npm, or when changesets are still pending.
