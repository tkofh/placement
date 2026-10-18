import { CubicPath2d, LinearPath2d } from 'curvy/path'
import { Linear2d } from 'curvy/splines'
import { Vector2 } from 'curvy/vector'
import type * as Adornment from 'placement/adornment'
import * as Interval from 'placement/interval'
import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import {
  type ComputedRef,
  Fragment,
  type MaybeRefOrGetter,
  type Ref,
  type Slots,
  type VNode,
  computed,
  h,
  inject,
  shallowRef,
  ssrContextKey,
  toValue,
  useAttrs,
  watchEffect,
} from 'vue'
import { type Child, useChild, useChildren } from '../composables/useChildren.ts'
import { type PaintProps, usePaint } from '../composables/usePaint.ts'
import { type DrawnLine, drawnLine } from './adornment.ts'
import { roundPolyline } from './corners.ts'

// The edges of both routers. An edge collects its adornment children, hands
// their specs to its layout, and gives each child where it landed. Its
// drawn line stops short of the trimming adornments at its ends, and takes
// the corner sizes the layout solved.

/**
 * An adornment on an edge: the core adornment (see `placement/adornment`),
 * and whether the edge's drawn line stops where it begins. A trimming
 * adornment at `at` `0` trims the start of the line, and one at `at` `1`
 * the end.
 */
export interface EdgeAdornmentInput {
  readonly adornment: Adornment.Adornment
  readonly trims?: boolean
}

/**
 * An edge's solved route: its polyline, its corner sizes, how much larger
 * than the innermost corner of its nest each corner is (`0` or left out
 * for none), its adornments, and whether it draws each one. An end that merges
 * with other edges' ends leaves the adornments they share there to one of
 * them. Adornments draw when `drawn` leaves them out.
 */
export interface EdgeRoute {
  readonly points: ReadonlyArray<Point.Point>
  readonly radii: ReadonlyArray<number>
  readonly outsets?: ReadonlyArray<number>
  readonly adornments: ReadonlyArray<Adornment.AdornmentPlacement>
  readonly drawn?: ReadonlyArray<boolean>
}

/**
 * Where an adornment landed, and `drawn: false` when another edge draws
 * the same adornment in its place.
 */
export type EdgeAdornmentPlacement = Adornment.AdornmentPlacement & {
  readonly drawn?: boolean
}

export const emptyRoute: EdgeRoute = { points: [], radii: [], adornments: [] }

/**
 * A solved edge: its route, how far each end of the drawn line stops short
 * of the route's ends to make room for trimming adornments, and the line it
 * draws.
 */
export interface EdgeSolution {
  readonly route: EdgeRoute
  readonly insets: { readonly start: number; readonly end: number }
  readonly line: DrawnLine
}

export const unplaced: Adornment.AdornmentPlacement = {
  rect: Rect.make(),
  angle: 0,
  along: Interval.make(0, 0),
}

/**
 * Whether the component renders on the server. `renderToString` provides
 * the SSR context app-wide.
 *
 * @returns `true` during SSR.
 */
export function isSSR(): boolean {
  return inject(ssrContextKey, null) !== null
}

/**
 * Collects an edge's adornment children on `channel`.
 *
 * @param channel - The adornment channel of the edge's layout.
 * @returns The adornment specs, in the children's resolved order, for the
 * edge's input, and `solve`, which takes the edge's route once the layout
 * gives it, assigns each child its placement, and returns the solved edge.
 */
export function useEdgeAdornments(channel: string): {
  readonly adornments: ComputedRef<ReadonlyArray<Adornment.Adornment>>
  readonly solve: (route: Readonly<Ref<EdgeRoute>>) => ComputedRef<EdgeSolution>
} {
  const children = shallowRef<ReadonlyArray<Child<EdgeAdornmentInput, EdgeAdornmentPlacement>>>([])

  // The route comes from the layout, which needs the adornments first, so
  // the assignment waits for `solve`.
  let assign: (() => void) | undefined

  // During SSR, effects never re-run, and `useChildren` maps synchronously
  // instead (see `useChildren.ts`), so the mapper assigns directly.
  const ssr = isSSR()

  useChildren<EdgeAdornmentInput, EdgeAdornmentPlacement>(channel, (list) => {
    children.value = list
    if (ssr) {
      assign?.()
    }
  })

  const solve = (route: Readonly<Ref<EdgeRoute>>): ComputedRef<EdgeSolution> => {
    // Each end of the drawn line stops where the trimming adornments at
    // that end begin.
    const insets = computed(() => {
      const { points, adornments: placed } = route.value
      let total = 0
      for (let i = 1; i < points.length; i++) {
        total += Point.distance(points[i - 1]!, points[i]!)
      }
      let start = 0
      let end = 0
      for (const [k, child] of children.value.entries()) {
        const { adornment, trims } = child.input.value
        const along = placed[k]?.along
        if (trims !== true || along === undefined) {
          continue
        }
        if (adornment.at < 0.5) {
          start = Math.max(start, along.end)
        } else {
          end = Math.max(end, total - along.start)
        }
      }
      return { start, end }
    })

    const line = computed(() =>
      drawnLine(route.value.points, route.value.radii, insets.value, route.value.outsets),
    )

    // As in the layouts, the mapper records the list and an effect writes
    // the outputs.
    const write = () => {
      const { adornments: placed, drawn } = route.value
      for (const [k, child] of children.value.entries()) {
        const placement = placed[k]
        child.output.value =
          placement === undefined
            ? unplaced
            : drawn?.[k] === false
              ? { ...placement, drawn: false }
              : placement
      }
    }
    assign = write

    watchEffect(write, { flush: 'pre' })

    return computed(() => ({ route: route.value, insets: insets.value, line: line.value }))
  }

  return {
    adornments: computed(() => children.value.map((child) => child.input.value.adornment)),
    solve,
  }
}

/**
 * Registers an adornment with the nearest edge that collects adornments on
 * `channel`.
 *
 * @param channel - The adornment channel of the edge's layout.
 * @param adornment - The adornment's frame and where it sits.
 * @returns Where the adornment landed, and whether its edge draws it.
 */
export function useEdgeAdornment(
  channel: string,
  adornment: MaybeRefOrGetter<EdgeAdornmentInput>,
): Readonly<Ref<EdgeAdornmentPlacement>> {
  return useChild<EdgeAdornmentInput, EdgeAdornmentPlacement>(channel, adornment, unplaced)
}

/**
 * Renders an edge: its drawn line as a path, with corners rounded to
 * `radius` within the sizes the layout solved, then its default slot, so
 * that adornments drawn there sit on top of the line.
 *
 * @param props - The edge's paint props.
 * @param slots - The edge's slots. The default slot receives the route's
 * points and corner sizes.
 * @param solution - The solved edge.
 * @param radius - The corner radius, `0` for sharp corners.
 * @param smoothing - The corner smoothing.
 * @returns The render function.
 */
export function useEdgeRenderer(
  props: PaintProps,
  slots: Slots,
  solution: ComputedRef<EdgeSolution>,
  radius: MaybeRefOrGetter<number>,
  smoothing: MaybeRefOrGetter<number>,
): () => VNode {
  const attrs = useAttrs()
  const paint = usePaint(props)

  const pathData = computed(() => {
    const { points, rooms, nests } = solution.value.line
    if (points.length < 2) {
      return undefined
    }
    const r = toValue(radius)
    if (r > 0) {
      const rounded = roundPolyline(points, r, toValue(smoothing), false, rooms, nests)
      return rounded === undefined ? undefined : CubicPath2d.toPathData(rounded)
    }
    const vectors = points.map((point) => Vector2.make(point.x, point.y))
    return LinearPath2d.toPathData(Linear2d.toPath(Linear2d.fromArray(vectors)))
  })

  return () => {
    const d = pathData.value
    const route = solution.value.route
    return h(Fragment, {}, [
      d === undefined
        ? null
        : h('path', {
            d,
            ...attrs,
            ...paint.value,
            // An SVG path with no fill attribute fills black. An edge is a
            // stroke by default.
            fill: paint.value.fill ?? 'none',
          }),
      slots.default?.({ points: route.points, radii: route.radii }),
    ])
  }
}
