import type * as Adornment from 'placement/adornment'
import type * as Connector from 'placement/connector'
import type * as Edge from 'placement/edge'
import type * as Point from 'placement/point'
import type * as Rect from 'placement/rect'

// A routing problem as plain JSON, for sharing a layout and replaying it
// outside the browser (see `packages/placement/scripts/scene.ts`). Every
// class is reduced to the fields its `make` takes. JSON holds no
// non-finite numbers, so those fields, like unset ones, are left out, and
// `make` reads a missing field as unset.

/** The routing spec's fields (see `ConnectorInput` in `placement/connector`). */
export type ConnectorSceneSpec = {
  readonly [K in keyof Connector.ConnectorInput]?: number
}

/** An adornment's fields (see `AdornmentInput` in `placement/adornment`). */
export type ConnectorSceneAdornment = Adornment.AdornmentInput

/** An edge's fields (see `EdgeInput` in `placement/edge`). */
export type ConnectorSceneEdge = Omit<Edge.EdgeInput<string>, 'adornments'> & {
  readonly adornments?: ReadonlyArray<ConnectorSceneAdornment>
}

/** A waypoint (see `ConnectorWaypoint` in `placement/connector`). */
export interface ConnectorSceneWaypoint {
  readonly x: number
  readonly y: number
  readonly arriving?: Point.PointLike
  readonly leaving?: Point.PointLike
}

/** An edge's route constraints (see `ConnectorEdgeOptions` in `placement/connector`). */
export interface ConnectorSceneEdgeOptions {
  readonly via?: ReadonlyArray<ConnectorSceneWaypoint>
  readonly avoid?: ReadonlyArray<Rect.RectLike>
  readonly turn?: number
  readonly jogAt?: number
}

/**
 * A routing problem as plain JSON: the arguments of `Connector.apply`
 * (from `placement/connector`) with every class reduced to the fields its
 * `make` takes, and unset or non-finite fields left out.
 */
export interface ConnectorScene {
  /** The routing spec. */
  readonly spec: ConnectorSceneSpec
  /** The rects, keyed by id. A node without an id has a key starting with `\0`. */
  readonly rects: Readonly<Record<string, Rect.RectLike>>
  /** The edges, in the order the layout routes them. */
  readonly edges: ReadonlyArray<ConnectorSceneEdge>
  /** The route constraints of each edge, in the order of the edges. */
  readonly options: { readonly edges: ReadonlyArray<ConnectorSceneEdgeOptions> }
}

// Every field of `ConnectorInput`, which the type keeps complete.
const SPEC_FIELDS: { readonly [K in keyof Connector.ConnectorInput]-?: true } = {
  clearance: true,
  gap: true,
  bendCost: true,
  alignAdornments: true,
  justifyAdornments: true,
  justifyAdornmentsSpace: true,
  justifyAdornmentsSpaceOuter: true,
  adornmentGap: true,
  jogAt: true,
  jogSlant: true,
  merge: true,
  mergeGap: true,
}

// The string and finite number fields of a record, and finite number pairs
// (an aspect ratio).
function plain(record: object): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    const kept =
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value)) ||
      (Array.isArray(value) &&
        value.length === 2 &&
        value.every((n) => typeof n === 'number' && Number.isFinite(n)))
    if (kept) {
      out[key] = value
    }
  }
  return out
}

const rectOf = ({ x, y, width, height }: Rect.RectLike): Rect.RectLike => ({ x, y, width, height })

function adornmentOf(adornment: Adornment.Adornment): ConnectorSceneAdornment {
  return plain(adornment.toJSON()) as ConnectorSceneAdornment
}

function edgeOf(edge: Edge.Edge<string>): ConnectorSceneEdge {
  const fields = plain(edge.toJSON()) as ConnectorSceneEdge
  return edge.adornments.length === 0
    ? fields
    : { ...fields, adornments: edge.adornments.map(adornmentOf) }
}

function waypointOf(waypoint: Connector.ConnectorWaypoint): ConnectorSceneWaypoint {
  const { x, y, arriving, leaving } = waypoint
  return {
    x,
    y,
    ...(arriving === undefined ? {} : { arriving: { x: arriving.x, y: arriving.y } }),
    ...(leaving === undefined ? {} : { leaving: { x: leaving.x, y: leaving.y } }),
  }
}

function optionsOf(options: Connector.ConnectorEdgeOptions): ConnectorSceneEdgeOptions {
  const { via, avoid, turn, jogAt } = options
  return {
    ...(via === undefined || via.length === 0 ? {} : { via: via.map(waypointOf) }),
    ...(avoid === undefined || avoid.length === 0 ? {} : { avoid: avoid.map(rectOf) }),
    ...plain({ turn, jogAt }),
  }
}

/**
 * Reduces the arguments of `Connector.apply` to a `ConnectorScene`.
 *
 * @param spec - The routing spec.
 * @param rects - The rects, keyed by id.
 * @param edges - The edges.
 * @param options - The route constraints of each edge.
 * @returns The scene, as plain JSON.
 */
export function toScene(
  spec: Connector.Connector,
  rects: Readonly<Record<string, Rect.Rect>>,
  edges: ReadonlyArray<Edge.Edge<string>>,
  options: ReadonlyArray<Connector.ConnectorEdgeOptions>,
): ConnectorScene {
  const keys = Object.keys(SPEC_FIELDS) as Array<keyof Connector.ConnectorInput>
  return {
    spec: plain(Object.fromEntries(keys.map((key) => [key, spec[key]]))) as ConnectorSceneSpec,
    rects: Object.fromEntries(Object.entries(rects).map(([id, rect]) => [id, rectOf(rect)])),
    edges: edges.map(edgeOf),
    options: { edges: options.map(optionsOf) },
  }
}
