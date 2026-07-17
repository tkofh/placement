# placement

Layout algorithms for 2D graphics.

| Package                           | Description                                                                                                                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`placement`](packages/placement) | The core library: flexbox, 1D track solvers, and immutable geometric value types (rect, point, dimensions, offset, interval). Framework-agnostic, ESM-only. |
| [`@placement/vue`](packages/vue)  | Vue 3 components and composables that render placement layouts as SVG, with CSS-flavored string props parsed by [valued](https://github.com/tkofh/valued).  |

`apps/playground` is a private Nuxt app for poking at behavior visually
(`pnpm dev`).

## Development

pnpm 11 + Turborepo. `pnpm build` / `pnpm test` / `pnpm typecheck` /
`pnpm bench` fan out through turbo; `pnpm check` runs oxlint + oxfmt and
`pnpm fix` auto-fixes both. The numerical contract is documented in
[PRECISION.md](PRECISION.md), repo conventions in [CLAUDE.md](CLAUDE.md), and
the release flow (Changesets + npm trusted publishing) in
[RELEASING.md](RELEASING.md).

## License

MIT
