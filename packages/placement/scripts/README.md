# scripts

Development tools for the `placement` package. They run on Node 26, which
runs TypeScript directly, against the workspace source rather than `dist`.

## scene

`scene.ts` routes a connector scene and writes three files beside it:

- `<name>.svg`, the rects, the routes with their corners rounded to the
  solved radii, the adornment rects, and each edge's index.
- `<name>.svg.png`, the same drawing as an image, on macOS only (through
  `qlmanage` and `sips`).
- `<name>.txt`, every route after each traced phase of the solve
  (`search`, `nudge`, `ports`, `slants`) and as returned
  (`final`), then the layout's notes.

```sh
pnpm --filter placement scene state.json
node packages/placement/scripts/scene.ts state.json --out out --phases
pbpaste | pnpm --filter placement scene - --out .
```

Relative paths resolve against the directory you run the command from.

| Flag              | Effect                                                                |
| ----------------- | --------------------------------------------------------------------- |
| `--out <dir>`     | Writes the files to `dir`. Defaults to the input's directory, or `.`. |
| `--edges <i,...>` | Prints and dumps only these edges, by index in the scene.             |
| `--keep <i,...>`  | Routes only these edges, to isolate an interaction. Indices stay put. |
| `--phases`        | Prints the per-phase routes too. The `.txt` file always holds them.   |

A route prints as its points, each followed by the heading (`>`, `<`,
`^`, `v`, or `/` for a slant) and length of the segment after it. A final
route also gives each corner's reach as `r`, and `!` marks an inner
segment shorter than two corner radii.

### Input

The tool reads three shapes of JSON:

- **A full scene**, any object with `rects`: the arguments of
  `Connector.apply` with every class reduced to the fields its `make`
  takes. `spec` holds `ConnectorInput` fields, `rects` maps ids to
  `{ x, y, width, height }`, and each of `edges` holds `EdgeInput` fields,
  with each adornment's `AdornmentInput` fields and its frame's
  `FrameInput` fields side by side in one object. `options` holds `edges`
  (per-edge `via`, `avoid`, `turn`, and `jogAt`, in edge order) and
  `shapes` (`PolygonInput` fields by id). A `null` or missing number is
  unset, since JSON has no non-finite numbers. Encoded fields also take
  their names (`"sourceSide": "bottom"`, `"merge": "side"`).
- **A playground state**, which the "copy state" button of the
  playground's connectors page writes. It holds the full scene under
  `scene`, and the tool routes that.
- **A short state**, the page's settings and node positions without
  `scene`. The tool rebuilds the page's scene from them, so it goes stale
  when the page changes.

```json
{
  "spec": { "clearance": 16, "gap": 8, "merge": "side" },
  "rects": {
    "a": { "x": 0, "y": 0, "width": 80, "height": 40 },
    "b": { "x": 200, "y": 120, "width": 80, "height": 40 }
  },
  "edges": [
    {
      "source": "a",
      "target": "b",
      "radius": 8,
      "adornments": [{ "width": 9, "height": 8, "at": 1, "orient": "forward" }]
    }
  ]
}
```
