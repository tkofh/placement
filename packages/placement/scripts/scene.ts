import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import { route } from '../src/internal/connector/canonical.ts'
import type { XY } from '../src/internal/orient.ts'
import * as Polygon from '../src/polygon.ts'
import * as Rect from '../src/rect.ts'

// Routes a connector scene and writes an SVG (and a PNG, on macOS) next to
// a dump of every route, so a layout can be looked at without the browser,
// against the workspace source rather than `dist`. See README.md here.

const USAGE = `usage: node packages/placement/scripts/scene.ts <scene.json | -> [options]

  --out <dir>       where to write <name>.svg, <name>.svg.png, and <name>.txt
                    (default: next to the input, or the current directory for -)
  --edges <i,j,...> print only these edges (by index)
  --keep <i,j,...>  route only these edges (by index), to isolate interactions
  --phases          also print the routes after each phase of the solve
  -h, --help        show this message`

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

// A full scene: the arguments of `Connector.apply` as plain JSON, every
// class reduced to the fields its `make` takes (the `ConnectorScene` that
// `@placement/vue` writes). JSON has no non-finite numbers, so `null`, like
// a missing field, is unset. Encoded fields (sides, turns, merges,
// positions, orients) also take their names.
type Loose<T> = { readonly [K in keyof T]?: T[K] | null }
type Coded<T> = number | keyof T | null

type SceneAdornment = Loose<Omit<Frame.FrameInput, 'id'>> &
  Loose<Omit<Adornment.AdornmentInput, 'frame' | 'position' | 'orient'>> & {
    readonly position?: Coded<typeof Adornment.position>
    readonly orient?: Coded<typeof Adornment.orient>
  }

type SceneEdge = Loose<
  Omit<Edge.EdgeInput<string>, 'source' | 'target' | 'sourceSide' | 'targetSide' | 'adornments'>
> & {
  readonly source: string
  readonly target: string
  readonly sourceSide?: Coded<typeof Edge.side>
  readonly targetSide?: Coded<typeof Edge.side>
  readonly adornments?: ReadonlyArray<SceneAdornment> | null
}

interface SceneWaypoint {
  readonly x: number
  readonly y: number
  readonly arriving?: Loose<XYLike> | null
  readonly leaving?: Loose<XYLike> | null
}

interface XYLike {
  readonly x: number
  readonly y: number
}

interface SceneEdgeOptions {
  readonly via?: ReadonlyArray<SceneWaypoint> | null
  readonly avoid?: ReadonlyArray<Rect.RectLike> | null
  readonly turn?: Coded<typeof Connector.turn>
  readonly jogAt?: number | null
}

interface Scene {
  readonly spec?:
    | (Loose<Omit<Connector.ConnectorInput, 'merge'>> & {
        readonly merge?: Coded<typeof Connector.merge>
      })
    | null
  readonly rects: Readonly<Record<string, Rect.RectLike>>
  readonly edges: ReadonlyArray<SceneEdge>
  readonly options?: {
    readonly edges?: ReadonlyArray<SceneEdgeOptions | null> | null
    readonly shapes?: Readonly<Record<string, Loose<Polygon.PolygonInput>>> | null
  } | null
}

// The short state the connectors playground's "copy state" writes: its
// settings and where each box sits. `fromShort` rebuilds the rest of the
// scene to match `apps/playground/pages/connectors.vue`. The page also
// writes the full scene under `scene`, which wins when present.
interface Short {
  readonly corners: boolean
  readonly gap: number
  readonly clearance: number
  readonly bendCost: number | 'auto'
  readonly justify: Ratio
  readonly jogAt: Ratio
  readonly slant: number
  readonly merge: keyof typeof Connector.merge
  readonly mergeGap: number | 'gap'
  readonly nodes: ReadonlyArray<{ readonly id: string; readonly x: number; readonly y: number }>
}

type Ratio = 'start' | 'center' | 'end'

const SIZES: Readonly<Record<string, readonly [number, number]>> = {
  web: [120, 40],
  mobile: [120, 40],
  gateway: [124, 48],
  auth: [112, 40],
  orders: [120, 40],
  billing: [120, 40],
  events: [136, 40],
  db: [120, 40],
}

const WORKERS = ['mailer', 'indexer', 'exporter'] as const

const EDGES: ReadonlyArray<{ from: string; to: string; label?: string }> = [
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
  ...WORKERS.map((worker) => ({ from: 'events', to: worker })),
]

const ratioOf = (value: Ratio) => (value === 'start' ? 0 : value === 'end' ? 1 : 0.5)

function fromShort(state: Short): Scene {
  const rects: Record<string, Rect.RectLike> = {}
  for (const node of state.nodes) {
    const [width, height] = SIZES[node.id] ?? [120, 40]
    rects[node.id] = { x: node.x, y: node.y, width, height }
  }
  // The workers row: a flex row, space-evenly, inside the group at
  // (520, 478) 456x138, inset 36 top, 14 the other sides, items 112x36.
  const inner = { x: 534, y: 514, width: 428, height: 88 }
  const space = (inner.width - 3 * 112) / 4
  for (const [k, worker] of WORKERS.entries()) {
    const x = inner.x + space + k * (112 + space)
    rects[worker] = { x, y: inner.y + (88 - 36) / 2, width: 112, height: 36 }
  }
  // The page draws corners of radius 10 with smoothing 0.6.
  const radius = state.corners ? 10 * 1.6 : 0
  const arrow: SceneAdornment = { width: 9, height: 8, offsetLeft: 4, at: 1, orient: 'forward' }
  const label: SceneAdornment = { width: 40, height: 16 }
  return {
    spec: {
      clearance: state.clearance,
      gap: state.gap,
      bendCost: state.bendCost === 'auto' ? null : state.bendCost,
      alignAdornments: 0.5,
      justifyAdornments: ratioOf(state.justify),
      justifyAdornmentsSpace: 0,
      justifyAdornmentsSpaceOuter: 0,
      adornmentGap: 0,
      jogAt: ratioOf(state.jogAt),
      jogSlant: state.slant,
      merge: state.merge,
      mergeGap: state.mergeGap === 'gap' ? null : state.mergeGap,
    },
    rects,
    edges: EDGES.map((edge) => ({
      source: edge.from,
      target: edge.to,
      radius,
      thickness: 1.75,
      adornments: edge.label === undefined ? [arrow] : [arrow, label],
    })),
  }
}

// A field's number: `undefined` for `null` or a missing field, and the
// code of a name in `codes`.
function field(
  value: unknown,
  where: string,
  codes?: Readonly<Record<string, number>>,
): number | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string' && codes !== undefined && Object.hasOwn(codes, value)) {
    return codes[value]
  }
  throw new TypeError(`${where}: unexpected ${JSON.stringify(value)}`)
}

// The numbers of a record's fields named in `keys`, without the unset ones.
function fields<K extends string>(
  record: Readonly<Partial<Record<K, unknown>>>,
  keys: ReadonlyArray<K>,
  where: string,
): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {}
  for (const key of keys) {
    const value = field(record[key], `${where}.${key}`)
    if (value !== undefined) {
      out[key] = value
    }
  }
  return out
}

const FRAME_KEYS = [
  'offsetTop',
  'offsetRight',
  'offsetBottom',
  'offsetLeft',
  'width',
  'height',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
  'grow',
  'shrink',
  'align',
  'stretch',
] as const

const SPEC_KEYS = [
  'clearance',
  'gap',
  'bendCost',
  'alignAdornments',
  'justifyAdornments',
  'justifyAdornmentsSpace',
  'justifyAdornmentsSpaceOuter',
  'adornmentGap',
  'jogAt',
  'jogSlant',
  'mergeGap',
] as const

const EDGE_KEYS = ['weight', 'minLength', 'sourceAt', 'targetAt', 'radius', 'thickness'] as const

const rectOf = ({ x, y, width, height }: Rect.RectLike) => Rect.make(x, y, width, height)

function adornmentOf(input: SceneAdornment, where: string): Adornment.Adornment {
  const ratio = input.aspectRatio
  return Adornment.make({
    frame: Frame.make({
      ...fields(input, FRAME_KEYS, where),
      ...(ratio === null || ratio === undefined ? {} : { aspectRatio: ratio }),
    }),
    at: field(input.at, `${where}.at`),
    position: field(input.position, `${where}.position`, Adornment.position),
    layer: field(input.layer, `${where}.layer`),
    orient: field(input.orient, `${where}.orient`, Adornment.orient),
  })
}

function edgeOf(input: SceneEdge, i: number): Edge.Edge<string> {
  const where = `edges[${i}]`
  if (typeof input.source !== 'string' || typeof input.target !== 'string') {
    throw new TypeError(`${where}: needs a source and a target id`)
  }
  return Edge.make({
    source: input.source,
    target: input.target,
    ...fields(input, EDGE_KEYS, where),
    sourceSide: field(input.sourceSide, `${where}.sourceSide`, Edge.side),
    targetSide: field(input.targetSide, `${where}.targetSide`, Edge.side),
    adornments: (input.adornments ?? []).map((adornment, k) =>
      adornmentOf(adornment, `${where}.adornments[${k}]`),
    ),
  })
}

// A direction of a waypoint. An unset coordinate leaves it without one.
const headingOf = (heading: Loose<XYLike> | null | undefined) =>
  heading === null || heading === undefined
    ? undefined
    : { x: heading.x ?? Number.NaN, y: heading.y ?? Number.NaN }

function optionsOf(input: SceneEdgeOptions | null, i: number): Connector.ConnectorEdgeOptions {
  const where = `options.edges[${i}]`
  return {
    via: input?.via?.map(({ x, y, arriving, leaving }) => ({
      x,
      y,
      arriving: headingOf(arriving),
      leaving: headingOf(leaving),
    })),
    avoid: input?.avoid?.map(rectOf),
    turn: field(input?.turn, `${where}.turn`, Connector.turn),
    jogAt: field(input?.jogAt, `${where}.jogAt`),
  }
}

// The scene as `Connector.apply` takes it, with only the edges `keep`
// names (all of them without it), and each routed edge's index in the
// scene.
function build(scene: Scene, keep: ReadonlySet<number> | undefined) {
  const indices = scene.edges.flatMap((_, i) => (keep === undefined || keep.has(i) ? [i] : []))
  const rects: Record<string, Rect.Rect> = {}
  for (const [id, rect] of Object.entries(scene.rects)) {
    rects[id] = rectOf(rect)
  }
  const shapes: Record<string, Polygon.Polygon> = {}
  for (const [id, shape] of Object.entries(scene.options?.shapes ?? {})) {
    const where = `options.shapes.${id}`
    shapes[id] = Polygon.make(fields(shape, ['sides', 'loops', 'phase', 'radius'], where))
  }
  const spec = scene.spec ?? {}
  return {
    indices,
    rects,
    edges: indices.map((i) => edgeOf(scene.edges[i] as SceneEdge, i)),
    spec: Connector.make({
      ...fields(spec, SPEC_KEYS, 'spec'),
      merge: field(spec.merge, 'spec.merge', Connector.merge),
    }),
    options: {
      edges: indices.map((i) => optionsOf(scene.options?.edges?.[i] ?? null, i)),
      shapes,
    },
  }
}

type Built = ReturnType<typeof build>

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

const nameOf = (edge: Edge.Edge<string>) => `${edge.source}->${edge.target}`

// A polyline as text: each point, with the reach of its corner (`r`) where
// `radii` gives one, then the heading and length of the segment after it,
// with `!` on an inner segment shorter than two corner radii.
function polyline(
  points: ReadonlyArray<XY>,
  radius: number,
  radii: ReadonlyArray<number> = [],
): string {
  const parts: Array<string> = []
  for (const [k, [x, y]] of points.entries()) {
    const reach = radii[k] ?? 0
    parts.push(`(${fmt(x)},${fmt(y)})${reach === 0 ? '' : `r${fmt(reach)}`}`)
    const next = points[k + 1]
    if (next !== undefined) {
      const dx = next[0] - x
      const dy = next[1] - y
      const length = Math.hypot(dx, dy)
      const heading = dx === 0 ? (dy > 0 ? 'v' : '^') : dy === 0 ? (dx > 0 ? '>' : '<') : '/'
      const jog = length < 2 * radius && k > 0 && k + 2 < points.length ? '!' : ''
      parts.push(` ${heading}${fmt(length)}${jog} `)
    }
  }
  return parts.join('')
}

const xyOf = (route: Connector.ConnectorRoute) => route.points.map(({ x, y }): XY => [x, y])

function dump(
  built: Built,
  layout: Connector.ConnectorLayout,
  shown: (i: number) => boolean,
): Array<string> {
  const lines: Array<string> = []
  for (const [k, route] of layout.edges.entries()) {
    const i = built.indices[k] as number
    const edge = built.edges[k] as Edge.Edge<string>
    if (!shown(i)) {
      continue
    }
    if (route === undefined) {
      lines.push(`${i} ${nameOf(edge)}: none`)
      continue
    }
    // The edges merged at each end, by index in the scene.
    const leaders = route.merged.map((m) => (m < 0 ? m : (built.indices[m] as number)))
    const merged = leaders.some((m) => m >= 0) ? ` merged ${leaders.join(',')}` : ''
    lines.push(`${i} ${nameOf(edge)}: ${polyline(xyOf(route), edge.radius, route.radii)}${merged}`)
  }
  for (const note of layout.notes) {
    lines.push(`note ${JSON.stringify(note)}`)
  }
  return lines
}

const COLORS = ['#8fb8ff', '#ffb38f', '#a8ff8f', '#ff8fd6', '#fff28f', '#8ffff2', '#d68fff']

// Ids as SVG text. Nodes without an id have keys that start with `\0`.
const escape = (text: string) =>
  text
    .replaceAll('\0', '#')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

// A route as an SVG path, each corner a circular arc that reaches its
// `radii` along both legs.
function pathOf(points: ReadonlyArray<XY>, radii: ReadonlyArray<number>): string {
  const at = (k: number) => points[k] as XY
  const parts = [`M${at(0)[0]} ${at(0)[1]}`]
  for (let k = 1; k + 1 < points.length; k++) {
    const [ax, ay] = at(k - 1)
    const [px, py] = at(k)
    const [bx, by] = at(k + 1)
    const reach = radii[k] ?? 0
    const inLength = Math.hypot(px - ax, py - ay)
    const outLength = Math.hypot(bx - px, by - py)
    const [ux, uy] = [(px - ax) / inLength, (py - ay) / inLength]
    const [vx, vy] = [(bx - px) / outLength, (by - py) / outLength]
    const cross = ux * vy - uy * vx
    const turn = Math.atan2(Math.abs(cross), ux * vx + uy * vy)
    if (!(reach > 0 && turn > 1e-9)) {
      parts.push(`L${px} ${py}`)
      continue
    }
    // A corner that turns `turn` reaches `r * tan(turn / 2)`, and a
    // clockwise turn (on screen, y down) sweeps the positive way.
    const r = reach / Math.tan(turn / 2)
    parts.push(
      `L${px - ux * reach} ${py - uy * reach}`,
      `A${r} ${r} 0 0 ${cross > 0 ? 1 : 0} ${px + vx * reach} ${py + vy * reach}`,
    )
  }
  const [xn, yn] = at(points.length - 1)
  parts.push(`L${xn} ${yn}`)
  return parts.join(' ')
}

// The drawing's bounds: the rects, the routes, the adornments, padded, and
// the origin, or `frame` where the scene has one.
function boundsOf(
  built: Built,
  layout: Connector.ConnectorLayout,
  frame: Rect.RectLike | undefined,
): Rect.RectLike {
  if (frame !== undefined) {
    return frame
  }
  const boxes: Array<Rect.RectLike> = Object.values(built.rects)
  for (const route of layout.edges) {
    for (const { x, y } of route?.points ?? []) {
      boxes.push({ x, y, width: 0, height: 0 })
    }
    for (const { rect } of route?.adornments ?? []) {
      boxes.push(rect)
    }
  }
  const pad = 24
  const x0 = Math.min(0, ...boxes.map((box) => box.x - pad))
  const y0 = Math.min(0, ...boxes.map((box) => box.y - pad))
  const x1 = Math.max(...boxes.map((box) => box.x + box.width + pad))
  const y1 = Math.max(...boxes.map((box) => box.y + box.height + pad))
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }
}

// The SVG is 2000px square, with the drawing centered in it, since the
// macOS thumbnailer only makes square images. `png` crops the margins.
const PIXELS = 2000

function svg(built: Built, layout: Connector.ConnectorLayout, bounds: Rect.RectLike): string {
  const side = Math.max(bounds.width, bounds.height)
  const vx = bounds.x - (side - bounds.width) / 2
  const vy = bounds.y - (side - bounds.height) / 2
  const out: Array<string> = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PIXELS}" height="${PIXELS}" viewBox="${vx} ${vy} ${side} ${side}" font-family="Helvetica, Arial" font-size="11">`,
    `<rect x="${vx}" y="${vy}" width="${side}" height="${side}" fill="#0b0e19"/>`,
  ]
  for (const [id, { x, y, width, height }] of Object.entries(built.rects)) {
    out.push(
      `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="10" fill="#2a3560" stroke="#ffffff40"/>`,
      `<text x="${x + width / 2}" y="${y + height / 2 + 4}" text-anchor="middle" fill="#fff" font-weight="600">${escape(id)}</text>`,
    )
  }
  for (const [k, route] of layout.edges.entries()) {
    if (route === undefined) {
      continue
    }
    const i = built.indices[k] as number
    const color = COLORS[i % COLORS.length] as string
    const points = xyOf(route)
    out.push(
      `<path d="${pathOf(points, route.radii)}" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.9"/>`,
    )
    for (const [x, y] of points.slice(1, -1)) {
      out.push(`<circle cx="${x}" cy="${y}" r="1.2" fill="${color}" opacity="0.6"/>`)
    }
    for (const { rect, angle } of route.adornments) {
      const cx = rect.x + rect.width / 2
      const cy = rect.y + rect.height / 2
      out.push(
        `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" fill="${color}" opacity="0.6" transform="rotate(${(angle * 180) / Math.PI} ${cx} ${cy})"/>`,
      )
    }
    // The index sits by the middle of the middle segment.
    const middle = Math.floor((points.length - 1) / 2)
    const [px, py] = points[middle] as XY
    const [qx, qy] = points[middle + 1] ?? [px, py]
    out.push(
      `<text x="${(px + qx) / 2 + 3}" y="${(py + qy) / 2 - 3}" fill="${color}" font-size="9" opacity="0.8">${i}</text>`,
    )
  }
  out.push('</svg>')
  return out.join('\n')
}

// Renders the SVG to `<file>.png` with the macOS thumbnailer, then crops
// the square to the drawing. Elsewhere, there is no PNG.
function png(file: string, outDir: string, bounds: Rect.RectLike): string | undefined {
  try {
    execFileSync('qlmanage', ['-t', '-s', String(PIXELS), '-o', outDir, file], { stdio: 'ignore' })
    const image = `${file}.png`
    const scale = PIXELS / Math.max(bounds.width, bounds.height)
    const height = String(Math.ceil(bounds.height * scale))
    const width = String(Math.ceil(bounds.width * scale))
    execFileSync('sips', ['-c', height, width, image], { stdio: 'ignore' })
    return image
  } catch {
    return undefined
  }
}

// ---------------------------------------------------------------------------
// Command line
// ---------------------------------------------------------------------------

interface Args {
  readonly file: string
  readonly out: string | undefined
  readonly edges: ReadonlySet<number> | undefined
  readonly keep: ReadonlySet<number> | undefined
  readonly phases: boolean
}

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`)
  process.exit(2)
}

function indices(flag: string, value: string | undefined): ReadonlySet<number> {
  const list = (value ?? '').split(',').map((part) => Number(part.trim()))
  if (value === undefined || value === '' || list.some((n) => !Number.isInteger(n) || n < 0)) {
    fail(`${flag} takes a comma-separated list of edge indices`)
  }
  return new Set(list)
}

function parse(argv: ReadonlyArray<string>): Args {
  let file: string | undefined
  let out: string | undefined
  let edges: ReadonlySet<number> | undefined
  let keep: ReadonlySet<number> | undefined
  let phases = false
  for (let k = 0; k < argv.length; k++) {
    const arg = argv[k] as string
    // `--flag=value` or `--flag value`.
    const split = arg.startsWith('--') ? arg.indexOf('=') : -1
    const flag = split < 0 ? arg : arg.slice(0, split)
    const value = () => (split < 0 ? argv[++k] : arg.slice(split + 1))
    if (flag === '-h' || flag === '--help') {
      console.log(USAGE)
      process.exit(0)
    } else if (flag === '--out') {
      out = value() ?? fail('--out takes a directory')
    } else if (flag === '--edges') {
      edges = indices(flag, value())
    } else if (flag === '--keep') {
      keep = indices(flag, value())
    } else if (flag === '--phases') {
      phases = true
    } else if ((flag.startsWith('-') && flag !== '-') || file !== undefined) {
      fail(`unexpected argument ${arg}`)
    } else {
      file = arg
    }
  }
  return { file: file ?? fail('missing the scene file'), out, edges, keep, phases }
}

function main(): void {
  const args = parse(process.argv.slice(2))
  // `pnpm scene` runs in the package, so paths resolve where pnpm started.
  const cwd = process.env['INIT_CWD'] ?? process.cwd()
  const stdin = args.file === '-'
  const path = resolve(cwd, args.file)
  const state = JSON.parse(readFileSync(stdin ? 0 : path, 'utf8')) as
    | (Short & { readonly scene?: Scene })
    | (Scene & { readonly scene?: Scene })
  const short = state.scene === undefined && !('rects' in state)
  const scene = state.scene ?? ('rects' in state ? state : fromShort(state))
  for (const i of [...(args.keep ?? []), ...(args.edges ?? [])]) {
    if (i >= scene.edges.length) {
      fail(`the scene has no edge ${i}, only ${scene.edges.length}`)
    }
  }

  const built = build(scene, args.keep)
  const shown = (i: number) => args.edges === undefined || args.edges.has(i)
  const phases: Array<string> = []
  const layout = route(built.rects, built.edges, built.spec, built.options, (phase, routes) => {
    phases.push(`== ${phase}`)
    for (const [k, points] of routes.entries()) {
      const i = built.indices[k] as number
      const edge = built.edges[k] as Edge.Edge<string>
      if (points !== undefined && shown(i)) {
        phases.push(`${i} ${nameOf(edge)}: ${polyline(points, edge.radius)}`)
      }
    }
  })
  const final = dump(built, layout, shown)

  const outDir = resolve(cwd, args.out ?? (stdin ? '.' : dirname(path)))
  const base = `${outDir}/${stdin ? 'scene' : basename(path).replace(/\.json$/, '')}`
  // The short state's scene fills the playground's 1000x640 drawing.
  const frame = short ? { x: 0, y: 0, width: 1000, height: 640 } : undefined
  const bounds = boundsOf(built, layout, frame)
  mkdirSync(outDir, { recursive: true })
  writeFileSync(`${base}.svg`, svg(built, layout, bounds))
  writeFileSync(`${base}.txt`, `${[...phases, '== final', ...final].join('\n')}\n`)
  console.log([...(args.phases ? [...phases, '== final'] : []), ...final].join('\n'))
  const image = png(`${base}.svg`, outDir, bounds)
  const written = [`${base}.svg`, ...(image === undefined ? [] : [image]), `${base}.txt`]
  console.log(`\nwrote ${written.join(', ')}`)
}

main()
