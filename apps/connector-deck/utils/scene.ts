// The scenes `scripts/scenes.ts` routes, as the slides read them, and the
// geometry helpers the drawings share.

export type XY = [number, number]

export interface SceneRect {
  id: string
  label: string
  kind: string
  x: number
  y: number
  width: number
  height: number
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface ScenePort {
  x: number
  y: number
  side: number
}

export interface SceneRoute {
  points: Array<XY>
  radii: Array<number>
  adornments: Array<Box & { angle: number }>
}

export interface SearchRun {
  events: Array<[number, number, number]>
  path: Array<number>
  cost: number | null
  states: number
}

export interface SceneData {
  name: string
  frame?: Box
  settings: {
    clearance: number
    gap: number
    bendCost: number
    crossingCost: number
    mergeGap: number
    radius: number
  }
  rects: Array<SceneRect>
  obstacles: Array<Box>
  zones: Array<Box>
  links: Array<{ from: string; to: string; label: string | null }>
  sides: Array<[number, number]>
  trial: Array<Array<XY> | null>
  candidates: Array<ScenePort>
  ports: Array<[ScenePort, ScenePort]>
  merges: Array<Array<{ edge: number; end: number }>>
  graph: { nodes: Array<XY>; edges: Array<[number, number]>; pins: Array<number> }
  phases: Record<string, Array<Array<XY> | null>>
  routes: Array<SceneRoute | null>
  notes: Array<Record<string, unknown>>
  search: {
    start: number
    goal: number
    bendCost: number
    dijkstra: SearchRun
    astar: SearchRun
  } | null
}

const modules = import.meta.glob<SceneData>('../data/*.json', { eager: true, import: 'default' })

export function sceneOf(name: string): SceneData {
  const data = modules[`../data/${name}.json`]
  if (data === undefined) {
    throw new Error(`no scene ${name}; run pnpm scenes`)
  }
  return data
}

// The edge colors, the playground's hues tuned for the deck background.
export const COLORS = [
  '#8fb8ff',
  '#ffb38f',
  '#a8ff8f',
  '#ff8fd6',
  '#fff28f',
  '#8ffff2',
  '#d68fff',
  '#ffd08f',
  '#8fffb8',
  '#b8c4ff',
  '#ff9f9f',
  '#c8ff8f',
  '#8fd6ff',
]

export const colorOf = (i: number) => COLORS[i % COLORS.length] as string

export const FILLS: Record<string, string> = {
  client: '#1f4a3a',
  service: '#243258',
  store: '#4f3519',
  worker: '#43274f',
  wall: '#30343f',
  node: '#2a3560',
}

// A route as an SVG path. With `radii`, each corner is a circular arc that
// reaches its radius along both legs, the way `scripts/scene.ts` draws them.
export function pathOf(points: ReadonlyArray<XY>, radii: ReadonlyArray<number> = []): string {
  if (points.length === 0) {
    return ''
  }
  const at = (k: number) => points[k] as XY
  const parts = [`M${at(0)[0]} ${at(0)[1]}`]
  for (let k = 1; k + 1 < points.length; k++) {
    const [ax, ay] = at(k - 1)
    const [px, py] = at(k)
    const [bx, by] = at(k + 1)
    const reach = radii[k] ?? 0
    const inLength = Math.hypot(px - ax, py - ay)
    const outLength = Math.hypot(bx - px, by - py)
    if (inLength === 0 || outLength === 0) {
      parts.push(`L${px} ${py}`)
      continue
    }
    const [ux, uy] = [(px - ax) / inLength, (py - ay) / inLength]
    const [vx, vy] = [(bx - px) / outLength, (by - py) / outLength]
    const cross = ux * vy - uy * vx
    const turn = Math.atan2(Math.abs(cross), ux * vx + uy * vy)
    if (!(reach > 0 && turn > 1e-9)) {
      parts.push(`L${px} ${py}`)
      continue
    }
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

// The bounds of a scene's rects, padded.
export function boundsOf(scene: SceneData, pad = 24): Box {
  if (scene.frame !== undefined) {
    return scene.frame
  }
  const xs = scene.rects.flatMap((r) => [r.x, r.x + r.width])
  const ys = scene.rects.flatMap((r) => [r.y, r.y + r.height])
  const x = Math.min(...xs) - pad
  const y = Math.min(...ys) - pad
  return { x, y, width: Math.max(...xs) + pad - x, height: Math.max(...ys) + pad - y }
}

export const OUTWARD: Array<XY> = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
]
