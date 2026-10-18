import * as Adornment from 'placement/adornment'
import * as Frame from 'placement/frame'
import { type MaybeRefOrGetter, type Ref, type VNode, computed, h } from 'vue'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { finiteNumber } from './curve.ts'
import type { EdgeAdornmentInput, EdgeAdornmentPlacement } from './edge.ts'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, useFrameInput } from './frame.ts'
import { type RatioInput, resolveRatio } from './props/ratio.ts'
import { useGroupRenderer } from './render.ts'
import { boolProp } from './utils.ts'

// The adornment components of both routers: a frame on an edge that its
// layout places, and that draws its children turned to face along the edge.

export type EdgeAdornmentOrient = 'auto' | 'none' | 'forward' | 'backward'

export interface EdgeAdornmentProps extends FrameItemProps {
  /**
   * Where the adornment sits along the edge: `'start'`, `'end'`,
   * `'center'` (default), or a ratio from `0` (the source) to `1` (the
   * target). At `'start'` or `'end'` it also trims the edge's drawn line,
   * which stops where the adornment begins, as an arrowhead needs.
   */
  at?: 'start' | 'end' | RatioInput
  /**
   * How it sits on the edge. `'flow'` (default) puts it on a straight run,
   * never on a corner: in a hierarchy, the run nearest `at`, which the
   * layout makes long enough for it, and on a connector, the run nearest
   * `at` that has room for it, which justifies its adornments between its
   * corners by the layout's `justifyAdornments`. Adornments at either end
   * pack against their node. Flow adornments in one `layer` on one run
   * line up one after another, and their margins along the line keep
   * them, and the corners, apart.
   * `'absolute'` puts it at `at` of the way along the drawn line, rounded
   * corners included, and takes no room.
   */
  position?: 'flow' | 'absolute'
  /**
   * The layer it occupies. Flow adornments make room only for others in
   * their layer, so adornments in different layers may overlap. Defaults to
   * `0`.
   */
  layer?: number | `${number}`
  /**
   * Which way it faces. `'forward'` turns its local x axis along the edge
   * toward the target, `'backward'` toward the source, and `'none'` keeps
   * it upright. `'auto'` (default) faces into the node at `'start'` and
   * `'end'`, so an arrowhead drawn pointing right points into its node, and
   * keeps it upright elsewhere. A turned adornment measures its margins and
   * `alignSelf` in its own frame.
   */
  orient?: EdgeAdornmentOrient
  debug?: boolean
}

const orients = {
  none: Adornment.orient.upright,
  forward: Adornment.orient.forward,
  backward: Adornment.orient.backward,
} as const

export const EDGE_ADORNMENT_PROP_KEYS = [
  ...FRAME_ITEM_PROP_KEYS,
  'at',
  'position',
  'layer',
  'orient',
  'debug',
] as const

/**
 * Sets up an adornment component: resolves its props into an adornment,
 * registers it with its edge, and renders its children where it landed.
 *
 * @param props - The component's props.
 * @param basis - The percent bases of its size and margins, or `undefined`
 * for its parent's.
 * @param register - Registers the adornment with its edge, and returns
 * where it landed.
 * @returns The render function.
 */
export function useEdgeAdornmentRenderer(
  props: EdgeAdornmentProps,
  basis: Parameters<typeof useFrameInput>[1],
  register: (
    adornment: MaybeRefOrGetter<EdgeAdornmentInput>,
  ) => Readonly<Ref<EdgeAdornmentPlacement>>,
): () => VNode | Array<VNode> {
  const input = useFrameInput(props, basis)

  const placement = register(
    computed(() => {
      const end = props.at === 'start' || props.at === 'end' ? props.at : undefined
      const orient = props.orient ?? 'auto'
      return {
        adornment: Adornment.make({
          frame: Frame.make(input.value),
          at: end === 'start' ? 0 : end === 'end' ? 1 : resolveRatio(props.at, 0.5),
          position:
            props.position === 'absolute' ? Adornment.position.absolute : Adornment.position.flow,
          layer: finiteNumber(props.layer),
          orient:
            orient === 'auto'
              ? end === 'start'
                ? Adornment.orient.backward
                : end === 'end'
                  ? Adornment.orient.forward
                  : Adornment.orient.upright
              : orients[orient],
        }),
        trims: end !== undefined,
      }
    }),
  )

  const rect = computed(() => placement.value.rect)

  useParentRectRegistration(rect)

  const render = useGroupRenderer(rect, () => boolProp(props.debug))

  return () => {
    const { angle, rect: placed, drawn } = placement.value
    // Another edge draws the adornment this one shares at a merged end.
    if (drawn === false) {
      return []
    }
    const children = render()
    if (angle === 0) {
      return children
    }
    const degrees = (angle * 180) / Math.PI
    const cx = placed.x + placed.width / 2
    const cy = placed.y + placed.height / 2
    return h('g', { transform: `rotate(${degrees} ${cx} ${cy})` }, children)
  }
}
