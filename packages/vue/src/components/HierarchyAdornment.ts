import * as Adornment from 'placement/adornment'
import * as Frame from 'placement/frame'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent, h } from 'vue'
import { useHierarchyAdornment, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { finiteNumber } from '../internal/curve.ts'
import { FRAME_ITEM_PROP_KEYS, type FrameItemProps, useFrameInput } from '../internal/frame.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'

export type HierarchyAdornmentOrient = 'auto' | 'none' | 'forward' | 'backward'

export interface HierarchyAdornmentProps extends FrameItemProps {
  /**
   * Where the adornment sits along the edge: `'start'`, `'end'`,
   * `'center'` (default), or a ratio from `0` (the source) to `1` (the
   * target). At `'start'` or `'end'` it also trims the edge's drawn line,
   * which stops where the adornment begins, as an arrowhead needs.
   */
  at?: 'start' | 'end' | RatioInput
  /**
   * How it sits on the edge. `'flow'` (default) puts it on the straight run
   * nearest `at`, never on a corner, and the layout makes the run long
   * enough for it. Adornments at either end pack against their node. Flow
   * adornments in one `layer` on one run line up one after another, and
   * their margins along the line keep them, and the corners, apart.
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
  orient?: HierarchyAdornmentOrient
  debug?: boolean
}

const orients = {
  none: Adornment.orient.upright,
  forward: Adornment.orient.forward,
  backward: Adornment.orient.backward,
} as const

export const HierarchyAdornment = defineComponent(
  (props: HierarchyAdornmentProps) => {
    const input = useFrameInput(props, useHierarchyPercentBasis())

    const placement = useHierarchyAdornment(
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
      const { angle, rect: placed } = placement.value
      const children = render()
      if (angle === 0) {
        return children
      }
      const degrees = (angle * 180) / Math.PI
      const cx = placed.x + placed.width / 2
      const cy = placed.y + placed.height / 2
      return h('g', { transform: `rotate(${degrees} ${cx} ${cy})` }, children)
    }
  },
  {
    name: 'HierarchyAdornment',
    props: [...FRAME_ITEM_PROP_KEYS, 'at', 'position', 'layer', 'orient', 'debug'],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
