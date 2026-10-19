# connector deck

A [Slidev](https://sli.dev) deck that explains how `placement/connector`
routes edges: the vocabulary, graphs and shortest paths (Dijkstra, A*), what
we ask of a route and how each wish becomes a cost, and the ten phases of the
pipeline. It is the draft of the connector demo, and it captures the router as
of 2026-10-19.

```sh
pnpm --filter @placement/connector-deck scenes   # route the scenes into data/
pnpm --filter @placement/connector-deck slides   # present, at localhost:3030
pnpm --filter @placement/connector-deck slides:build
```

## How the drawings work

Almost every drawing is the real router's output. `scripts/scenes.ts` defines
the scenes, routes them against the workspace source (not `dist`), and writes
`data/<scene>.json`, which holds:

- the rects, the obstacles grown by the clearance, and the merge zones
- the visibility graph on the final ports, and its pins
- the candidate ports of side selection and its trial routes
- the routes after each traced phase (`search`, `nudge`, `ports`, `whisks`,
  `slants`) and as returned, with corner radii and adornments
- the notes
- for scenes that set `search`, a Dijkstra run and an A* run on the scene's
  graph. They price length and bends only, so they illustrate the
  algorithms and do not reproduce the router's search.

Run `scenes` again after you change the router, and the deck shows the new
behavior. The JSON is committed so the deck runs without that step.

## Components

| component       | draws                                                              |
| --------------- | ------------------------------------------------------------------ |
| `SceneView`     | one scene, in layers (`rects graph zones routes points jogs …`)    |
| `SearchPlayer`  | Dijkstra and A* side by side on one scene's graph, with a scrubber |
| `WeightedGraph` | a small weighted graph, and Dijkstra on it one step per click      |
| `TurnStates`    | why the search's state is the half-edge, not the node             |
| `CostCurve`     | the short-jog price and the congestion price                       |
| `PipelineStrip` | the ten phases, with the current one lit                           |
| `Anatomy`       | a hand-drawn route with its parts labeled                          |

`SceneView` takes `phase` (`final`, `trial`, or a traced phase), `ghost` (a
second phase drawn faintly under it), `highlight` and `only` (edge indices),
and `view` (`[x, y, width, height]`, to zoom in). Its strokes and labels keep
their size on screen at any zoom.

Slidev turns on UnoCSS attributify, which reads an SVG `opacity="0.5"`
attribute as a utility class and sets the opacity to 0.005. Set opacity with
`style` in these components.
