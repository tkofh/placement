import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as Adornment from '../../../packages/placement/src/adornment.ts'
import * as Connector from '../../../packages/placement/src/connector.ts'
import * as Edge from '../../../packages/placement/src/edge.ts'
import * as Frame from '../../../packages/placement/src/frame.ts'
import { planMerges } from '../../../packages/placement/src/internal/connector/merge.ts'
import { solve } from '../../../packages/placement/src/internal/connector/pipeline.ts'
import {
  type Port,
  normalize,
  pinOf,
  portOf,
} from '../../../packages/placement/src/internal/connector/problem.ts'
import { chooseSides } from '../../../packages/placement/src/internal/connector/sides.ts'
import { placePorts } from '../../../packages/placement/src/internal/connector/spread.ts'
import { type Graph } from '../../../packages/placement/src/internal/graph/graph.ts'
import { visibilityGraph } from '../../../packages/placement/src/internal/graph/visibility.ts'
import * as Rect from '../../../packages/placement/src/rect.ts'

// Routes the deck's scenes against the workspace source and writes what
// the slides draw to `data/<name>.json`: the rects, the obstacles and merge
// zones, the visibility graph on the final ports, the candidate and final
// ports, the trial routes of side selection, the routes after each traced
// phase, the final routes, and the notes. Scenes marked `search` also get
// a step-by-step Dijkstra and A* on their graph, for the search player.
//
//   pnpm --filter @placement/connector-deck scenes

type XY = readonly [number, number]

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../data')

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

interface Box {
  readonly id: string
  readonly label?: string
  readonly kind?: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

interface Link {
  readonly from: string
  readonly to: string
  readonly label?: string
  readonly sourceSide?: keyof typeof Edge.side
  readonly targetSide?: keyof typeof Edge.side
  readonly radius?: number
  // Fixed positions along the sides, which keep the ports from sliding.
  readonly sourceAt?: number
  readonly targetAt?: number
}

interface SceneDef {
  readonly name: string
  readonly boxes: ReadonlyArray<Box>
  readonly links: ReadonlyArray<Link>
  readonly spec?: Connector.ConnectorInput
  readonly radius?: number
  readonly frame?: { x: number; y: number; width: number; height: number }
  // Run the didactic searches for this edge.
  readonly search?: number
}

const arrow = () =>
  Adornment.make({
    frame: Frame.make({ width: 9, height: 8, offsetLeft: 4 }),
    at: 1,
    orient: Adornment.orient.forward,
  })

const label = () => Adornment.make({ frame: Frame.make({ width: 40, height: 16 }) })

// The playground's connectors page, as its defaults set it up.
const PLAYGROUND_SPEC: Connector.ConnectorInput = {
  clearance: 16,
  gap: 8,
  alignAdornments: 0.5,
  justifyAdornments: 0.5,
  justifyAdornmentsSpace: 0,
  justifyAdornmentsSpaceOuter: 0,
  adornmentGap: 0,
  jogAt: 0.5,
  jogSlant: 2,
  merge: Connector.merge.side,
  mergeGap: 4,
}

const SERVICES: ReadonlyArray<Box> = [
  { id: 'web', label: 'web app', kind: 'client', x: 48, y: 96, width: 120, height: 40 },
  { id: 'mobile', label: 'mobile', kind: 'client', x: 48, y: 268, width: 120, height: 40 },
  { id: 'gateway', label: 'gateway', kind: 'service', x: 264, y: 176, width: 124, height: 48 },
  { id: 'auth', label: 'auth', kind: 'service', x: 264, y: 392, width: 112, height: 40 },
  { id: 'orders', label: 'orders', kind: 'service', x: 512, y: 96, width: 120, height: 40 },
  { id: 'billing', label: 'billing', kind: 'service', x: 512, y: 288, width: 120, height: 40 },
  { id: 'events', label: 'event bus', kind: 'store', x: 784, y: 176, width: 136, height: 40 },
  { id: 'db', label: 'postgres', kind: 'store', x: 784, y: 360, width: 120, height: 40 },
  ...['mailer', 'indexer', 'exporter'].map((id, k) => {
    // A flex row, space-evenly, inside the workers group.
    const space = (428 - 3 * 112) / 4
    return {
      id,
      label: id,
      kind: 'worker',
      x: 534 + space + k * (112 + space),
      y: 540,
      width: 112,
      height: 36,
    }
  }),
]

const SERVICE_LINKS: ReadonlyArray<Link> = [
  { from: 'web', to: 'gateway' },
  { from: 'mobile', to: 'gateway' },
  { from: 'gateway', to: 'auth', label: 'jwt' },
  { from: 'gateway', to: 'orders' },
  { from: 'gateway', to: 'billing' },
  { from: 'auth', to: 'db', label: 'sql' },
  { from: 'orders', to: 'events' },
  { from: 'billing', to: 'events' },
  { from: 'orders', to: 'db' },
  { from: 'billing', to: 'db' },
  { from: 'events', to: 'mailer' },
  { from: 'events', to: 'indexer' },
  { from: 'events', to: 'exporter' },
]

const PLAYGROUND_FRAME = { x: 0, y: 40, width: 1000, height: 600 }

const moved = (id: string, x: number, y: number) =>
  SERVICES.map((box) => (box.id === id ? { ...box, x, y } : box))

const SCENES: ReadonlyArray<SceneDef> = [
  // The playground's default scene.
  {
    name: 'services',
    boxes: SERVICES,
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },
  // One long edge added, for the search player.
  {
    name: 'services-search',
    boxes: SERVICES,
    links: [
      ...SERVICE_LINKS,
      { from: 'web', to: 'exporter', sourceSide: 'right', targetSide: 'top' },
    ],
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
    search: SERVICE_LINKS.length,
  },
  // Billing dragged into the column under the event bus.
  {
    name: 'diabolical',
    boxes: moved('billing', 608.7, 379.4),
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },
  // Auth dragged around, from problem-cases.md: small moves, big swings.
  {
    name: 'auth-1',
    boxes: moved('auth', 362.94, 404.27),
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },
  {
    name: 'auth-2',
    boxes: moved('auth', 362.24, 395.22),
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },
  {
    name: 'auth-3',
    boxes: moved('auth', 362.4, 352.87),
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },
  {
    name: 'auth-4',
    boxes: moved('auth', 376.87, 332.53),
    links: SERVICE_LINKS,
    spec: PLAYGROUND_SPEC,
    radius: 16,
    frame: PLAYGROUND_FRAME,
  },

  // Scattered blocks between two rects: a staircase through them is as
  // short as the Z the router takes, with four more corners.
  ...['stairs'].map(
    (name): SceneDef => ({
      name,
      boxes: [
        { id: 'a', label: 'A', x: 30, y: 30, width: 90, height: 36 },
        { id: 'k1', label: '', kind: 'wall', x: 170, y: 100, width: 44, height: 28 },
        { id: 'k2', label: '', kind: 'wall', x: 250, y: 50, width: 44, height: 28 },
        { id: 'k3', label: '', kind: 'wall', x: 260, y: 160, width: 44, height: 28 },
        { id: 'k4', label: '', kind: 'wall', x: 340, y: 110, width: 44, height: 28 },
        { id: 'k5', label: '', kind: 'wall', x: 360, y: 220, width: 44, height: 28 },
        { id: 'b', label: 'B', x: 470, y: 250, width: 90, height: 36 },
      ],
      links: [
        {
          from: 'a',
          to: 'b',
          sourceSide: 'right',
          targetSide: 'left',
          sourceAt: 0.5,
          targetAt: 0.5,
        },
      ],
      spec: { clearance: 12, gap: 8 },
      radius: 10,
      frame: { x: 0, y: 0, width: 590, height: 310 },
    }),
  ),
  // A small scene to build the graph and search on.
  {
    name: 'toy',
    boxes: [
      { id: 'a', label: 'A', x: 40, y: 60, width: 100, height: 44 },
      { id: 'wall', label: '', kind: 'wall', x: 230, y: 30, width: 110, height: 170 },
      { id: 'c', label: 'C', x: 150, y: 250, width: 90, height: 40 },
      { id: 'b', label: 'B', x: 450, y: 230, width: 100, height: 44 },
    ],
    links: [{ from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left' }],
    spec: { clearance: 16, gap: 8 },
    radius: 12,
    frame: { x: 0, y: 0, width: 600, height: 330 },
    search: 0,
  },
  // A short jog between auto ports: the ports slide it away.
  {
    name: 'jog-slide',
    boxes: [
      { id: 'a', label: 'A', x: 40, y: 60, width: 110, height: 40 },
      { id: 'b', label: 'B', x: 330, y: 74, width: 110, height: 40 },
    ],
    links: [{ from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left' }],
    spec: { clearance: 16, gap: 8, jogSlant: 2 },
    radius: 16,
    frame: { x: 0, y: 20, width: 480, height: 120 },
  },
  // Jogs between fixed ports: nearly aligned rects, and farther apart.
  {
    name: 'jog-short',
    boxes: [
      { id: 'a', label: 'A', x: 40, y: 60, width: 110, height: 40 },
      { id: 'b', label: 'B', x: 330, y: 74, width: 110, height: 40 },
    ],
    links: [
      { from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left', sourceAt: 0.5, targetAt: 0.5 },
    ],
    spec: { clearance: 16, gap: 8, jogSlant: 2 },
    radius: 16,
    frame: { x: 0, y: 20, width: 480, height: 120 },
  },
  {
    name: 'jog-short-upright',
    boxes: [
      { id: 'a', label: 'A', x: 40, y: 60, width: 110, height: 40 },
      { id: 'b', label: 'B', x: 330, y: 74, width: 110, height: 40 },
    ],
    links: [
      { from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left', sourceAt: 0.5, targetAt: 0.5 },
    ],
    spec: { clearance: 16, gap: 8, jogSlant: 0 },
    radius: 16,
    frame: { x: 0, y: 20, width: 480, height: 120 },
  },
  {
    name: 'jog-long',
    boxes: [
      { id: 'a', label: 'A', x: 40, y: 30, width: 110, height: 40 },
      { id: 'b', label: 'B', x: 330, y: 100, width: 110, height: 40 },
    ],
    links: [
      { from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left', sourceAt: 0.5, targetAt: 0.5 },
    ],
    spec: { clearance: 16, gap: 8, jogSlant: 2 },
    radius: 16,
    frame: { x: 0, y: 0, width: 480, height: 170 },
  },
  // Two routes through one gap: the search stacks them, the nudge spreads them.
  {
    name: 'corridor',
    boxes: [
      { id: 'a1', label: 'A1', x: 30, y: 40, width: 90, height: 36 },
      { id: 'a2', label: 'A2', x: 30, y: 230, width: 90, height: 36 },
      { id: 'top', label: '', kind: 'wall', x: 210, y: 10, width: 100, height: 120 },
      { id: 'bottom', label: '', kind: 'wall', x: 210, y: 176, width: 100, height: 130 },
      { id: 'b1', label: 'B1', x: 420, y: 40, width: 90, height: 36 },
      { id: 'b2', label: 'B2', x: 420, y: 230, width: 90, height: 36 },
    ],
    links: [
      { from: 'a1', to: 'b2', sourceSide: 'right', targetSide: 'left' },
      { from: 'a2', to: 'b1', sourceSide: 'right', targetSide: 'left' },
    ],
    spec: { clearance: 14, gap: 10 },
    radius: 12,
    frame: { x: 0, y: 0, width: 540, height: 316 },
  },
  // One source fanning out to three targets: a merge with lanes and whisks.
  {
    name: 'fan',
    boxes: [
      { id: 'hub', label: 'event bus', kind: 'store', x: 200, y: 30, width: 150, height: 40 },
      { id: 'w1', label: 'mailer', kind: 'worker', x: 40, y: 230, width: 110, height: 36 },
      { id: 'w2', label: 'indexer', kind: 'worker', x: 220, y: 230, width: 110, height: 36 },
      { id: 'w3', label: 'exporter', kind: 'worker', x: 400, y: 230, width: 110, height: 36 },
    ],
    links: [
      { from: 'hub', to: 'w1', sourceSide: 'bottom', targetSide: 'top' },
      { from: 'hub', to: 'w2', sourceSide: 'bottom', targetSide: 'top' },
      { from: 'hub', to: 'w3', sourceSide: 'bottom', targetSide: 'top' },
    ],
    spec: { clearance: 16, gap: 8, merge: Connector.merge.side, mergeGap: 4, jogSlant: 2 },
    radius: 16,
    frame: { x: 0, y: 0, width: 550, height: 300 },
  },
  {
    name: 'fan-nomerge',
    boxes: [
      { id: 'hub', label: 'event bus', kind: 'store', x: 200, y: 30, width: 150, height: 40 },
      { id: 'w1', label: 'mailer', kind: 'worker', x: 40, y: 230, width: 110, height: 36 },
      { id: 'w2', label: 'indexer', kind: 'worker', x: 220, y: 230, width: 110, height: 36 },
      { id: 'w3', label: 'exporter', kind: 'worker', x: 400, y: 230, width: 110, height: 36 },
    ],
    links: [
      { from: 'hub', to: 'w1', sourceSide: 'bottom', targetSide: 'top' },
      { from: 'hub', to: 'w2', sourceSide: 'bottom', targetSide: 'top' },
      { from: 'hub', to: 'w3', sourceSide: 'bottom', targetSide: 'top' },
    ],
    spec: { clearance: 16, gap: 8, jogSlant: 2 },
    radius: 16,
    frame: { x: 0, y: 0, width: 550, height: 300 },
  },
]

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

const r2 = (n: number) => Math.round(n * 100) / 100
const pt = ([x, y]: XY): [number, number] => [r2(x), r2(y)]
const box = (o: { left: number; top: number; right: number; bottom: number }) => ({
  x: r2(o.left),
  y: r2(o.top),
  width: r2(o.right - o.left),
  height: r2(o.bottom - o.top),
})

function edgesOf(graph: Graph): Array<[number, number]> {
  const list: Array<[number, number]> = []
  for (let i = 0; i + 1 < graph.offsets.length; i++) {
    for (let e = graph.offsets[i] as number; e < (graph.offsets[i + 1] as number); e++) {
      const t = graph.targets[e] as number
      if (i < t) {
        list.push([i, t])
      }
    }
  }
  return list
}

function capture(scene: SceneDef) {
  const rects: Record<string, Rect.Rect> = {}
  for (const b of scene.boxes) {
    rects[b.id] = Rect.make(b.x, b.y, b.width, b.height)
  }
  const edges = scene.links.map((link) =>
    Edge.make({
      source: link.from,
      target: link.to,
      radius: link.radius ?? scene.radius ?? 0,
      thickness: 1.75,
      sourceSide: link.sourceSide === undefined ? undefined : Edge.side[link.sourceSide],
      targetSide: link.targetSide === undefined ? undefined : Edge.side[link.targetSide],
      sourceAt: link.sourceAt,
      targetAt: link.targetAt,
      adornments: link.label === undefined ? [arrow()] : [arrow(), label()],
    }),
  )
  const spec = Connector.make(scene.spec ?? {})
  const problem = normalize(rects, edges, spec, {})

  const phases: Record<string, Array<Array<[number, number]> | null>> = {}
  const layout = solve(problem, (phase, routes) => {
    phases[phase] = routes.map((route) => (route === undefined ? null : route.map(pt)))
  })

  // The phases before the search, again, for what they leave behind.
  const chosen = chooseSides(problem)
  const placed = placePorts(problem, chosen)
  const plan = planMerges(problem, placed.ports, placed.merges)
  const pins = [...problem.extraPins]
  for (const [i, edge] of problem.edges.entries()) {
    const [source, target] = plan.ports[i] as [Port, Port]
    pins.push(pinOf(source, edge.source), pinOf(target, edge.target))
  }
  const { graph, pins: pinNodes } = visibilityGraph(plan.blocks, pins)

  // The candidate ports side selection weighs: the middle of every side of
  // an auto end.
  const candidates = problem.edges.flatMap((edge) =>
    edge.ends.flatMap((end) =>
      end.side === undefined
        ? [0, 1, 2, 3].map((s) => {
            const port = portOf(problem, end.rect, s, 0.5)
            return { x: r2(port.x), y: r2(port.y), side: s }
          })
        : [],
    ),
  )

  const ids = problem.ids
  const data = {
    name: scene.name,
    frame: scene.frame,
    settings: {
      clearance: problem.settings.clearance,
      gap: problem.settings.gap,
      bendCost: problem.bendCost,
      crossingCost: problem.crossingCost,
      mergeGap: problem.mergeGap,
      radius: scene.radius ?? 0,
    },
    rects: scene.boxes.map((b) => ({
      id: b.id,
      label: b.label ?? b.id,
      kind: b.kind ?? 'node',
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height,
    })),
    obstacles: problem.obstacles.map(box),
    zones: plan.blocks.slice(problem.obstacles.length).map(box),
    links: scene.links.map((link) => ({ from: link.from, to: link.to, label: link.label ?? null })),
    sides: chosen.sides,
    trial: chosen.trial.map((route) => (route === undefined ? null : route.map(pt))),
    candidates,
    ports: plan.ports.map(([s, t]) => [
      { x: r2(s.x), y: r2(s.y), side: s.side },
      { x: r2(t.x), y: r2(t.y), side: t.side },
    ]),
    merges: placed.merges.map((m) => m.ends.map((e) => ({ edge: e.edge, end: e.end }))),
    graph: {
      nodes: Array.from(graph.xs, (x, i) => [r2(x), r2(graph.ys[i] as number)]),
      edges: edgesOf(graph),
      pins: Array.from(pinNodes.slice(problem.extraPins.length)),
    },
    phases,
    routes: layout.edges.map((route) =>
      route === undefined
        ? null
        : {
            points: route.points.map(({ x, y }) => pt([x, y])),
            radii: route.radii.map(r2),
            adornments: route.adornments.map(({ rect, angle }) => ({
              x: r2(rect.x),
              y: r2(rect.y),
              width: r2(rect.width),
              height: r2(rect.height),
              angle: r2((angle * 180) / Math.PI),
            })),
          },
    ),
    notes: layout.notes.map((note) => JSON.parse(JSON.stringify(note))),
    search:
      scene.search === undefined
        ? null
        : searches(
            graph,
            pinNodes,
            problem.extraPins.length,
            scene.search,
            plan.ports,
            problem.bendCost,
          ),
    ids,
  }
  return data
}

// ---------------------------------------------------------------------------
// Didactic searches
// ---------------------------------------------------------------------------

// Dijkstra and A* over (node, heading) states on the visibility graph, with
// length plus a cost per turn, the way the real search prices a route
// without crossings, merges, congestion, or jogs. Each event is
// `[kind, node, parent]`: `0` a node joins the frontier, `1` it settles.

const DX = [0, 1, 0, -1]
const DY = [-1, 0, 1, 0]

function headingBetween(graph: Graph, a: number, b: number): number {
  const dx = (graph.xs[b] as number) - (graph.xs[a] as number)
  const dy = (graph.ys[b] as number) - (graph.ys[a] as number)
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 1 : 3
  }
  return dy > 0 ? 2 : 0
}

function searches(
  graph: Graph,
  pinNodes: Int32Array,
  offset: number,
  edge: number,
  ports: ReadonlyArray<[Port, Port]>,
  bendCost: number,
) {
  const [source, target] = ports[edge] as [Port, Port]
  const start = pinNodes[offset + 2 * edge] as number
  const goal = pinNodes[offset + 2 * edge + 1] as number
  const leave = source.side
  // A route arrives heading into the target's side.
  const arrive = (target.side + 2) % 4
  const gx = graph.xs[goal] as number
  const gy = graph.ys[goal] as number
  const run = (astar: boolean) => {
    const h = (n: number) =>
      astar ? Math.abs((graph.xs[n] as number) - gx) + Math.abs((graph.ys[n] as number) - gy) : 0
    const key = (n: number, d: number) => 4 * n + d
    const best = new Map<number, number>()
    const parent = new Map<number, number>()
    const settled = new Set<number>()
    const open: Array<{ n: number; d: number; g: number; f: number; seq: number }> = []
    const events: Array<[number, number, number]> = []
    const seenNode = new Set<number>()
    const settledNode = new Set<number>()
    let seq = 0
    const push = (n: number, d: number, g: number, from: number) => {
      const k = key(n, d)
      if (g >= (best.get(k) ?? Infinity) - 1e-9) {
        return
      }
      best.set(k, g)
      parent.set(k, from)
      open.push({ n, d, g, f: g + h(n), seq: seq++ })
      if (!seenNode.has(n)) {
        seenNode.add(n)
        events.push([0, n, from < 0 ? -1 : Math.floor(from / 4)])
      }
    }
    push(start, leave, 0, -1)
    let found: number | undefined
    let expanded = 0
    while (open.length > 0) {
      open.sort((a, b) => a.f - b.f || a.seq - b.seq)
      const { n, d, g } = open.shift() as (typeof open)[number]
      const k = key(n, d)
      if (settled.has(k) || g > (best.get(k) ?? Infinity) + 1e-9) {
        continue
      }
      settled.add(k)
      expanded++
      if (!settledNode.has(n)) {
        settledNode.add(n)
        const from = parent.get(k) ?? -1
        events.push([1, n, from < 0 ? -1 : Math.floor(from / 4)])
      }
      if (n === goal && d === arrive) {
        found = k
        break
      }
      for (let e = graph.offsets[n] as number; e < (graph.offsets[n + 1] as number); e++) {
        const t = graph.targets[e] as number
        const nd = headingBetween(graph, n, t)
        if (nd === (d + 2) % 4) {
          continue
        }
        const length = Math.hypot(
          (graph.xs[t] as number) - (graph.xs[n] as number),
          (graph.ys[t] as number) - (graph.ys[n] as number),
        )
        push(t, nd, g + length + (nd === d ? 0 : bendCost), k)
      }
    }
    const path: Array<number> = []
    for (let k = found; k !== undefined && k >= 0; k = parent.get(k)) {
      path.unshift(Math.floor(k / 4))
      if (parent.get(k) === -1) {
        break
      }
    }
    return {
      events,
      path,
      cost: found === undefined ? null : r2(best.get(found) as number),
      states: expanded,
    }
  }
  return {
    start,
    goal,
    bendCost,
    dijkstra: run(false),
    astar: run(true),
    // Headings, for the state diagram.
    headings: DX.map((dx, d) => [dx, DY[d]]),
  }
}

// ---------------------------------------------------------------------------

mkdirSync(out, { recursive: true })
for (const scene of SCENES) {
  const data = capture(scene)
  writeFileSync(resolve(out, `${scene.name}.json`), `${JSON.stringify(data)}\n`)
  const routed = data.routes.filter((r) => r !== null).length
  const extra = data.search
    ? ` dijkstra ${data.search.dijkstra.states} states / A* ${data.search.astar.states} states, cost ${data.search.astar.cost}`
    : ''
  console.log(
    `${scene.name}: ${routed}/${data.links.length} routed, ${data.graph.nodes.length} nodes, ${data.graph.edges.length} edges, ${data.notes.length} notes${extra}`,
  )
}
