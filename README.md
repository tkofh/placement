# placement

Layout algorithms for 2D graphics.

| Package                           | Description                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`placement`](packages/placement) | The core library: flexbox, 1D track solvers, and immutable geometric value types (rect, point, dimensions, offset, interval). Framework-agnostic, ESM-only. |
| [`@placement/vue`](packages/vue)  | Vue 3 components and composables that render placement layouts as SVG, with CSS-flavored string props parsed by [valued](https://github.com/tkofh/valued).  |

`apps/playground` is a private Nuxt app to look at behavior visually
(`pnpm dev`).

## Development

The repo uses pnpm 11 and Turborepo. `pnpm build`, `pnpm test`,
`pnpm typecheck`, and `pnpm bench` run across the packages through turbo.
`pnpm check` runs oxlint and oxfmt, and `pnpm fix` applies the automatic fixes
of both. [PRECISION.md](PRECISION.md) documents the numerical contract.
[CLAUDE.md](CLAUDE.md) documents the repo conventions.
[RELEASING.md](RELEASING.md) documents the release flow, which uses Changesets
and npm trusted publishing.

## License

MIT
