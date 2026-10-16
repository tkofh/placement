import * as Connector from 'placement/connector'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useConnectorLayout } from '../composables/useConnector.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type LengthPercentageInput, useLengthPercentage } from '../props/lengthPercentage.ts'

export interface ConnectorLayoutProps extends RectProps {
  /** A prebuilt spec. When set, it replaces every other routing prop. */
  layout?: Connector.Connector
  /**
   * The space routes keep from the nodes they pass, except where they
   * leave or enter one. Percentages resolve against the width of the
   * layout's parent, as do the other lengths.
   */
  clearance?: LengthPercentageInput
  /**
   * The distance between routes that run alongside each other. Where a
   * passage is too narrow, the routes in it spread evenly across it.
   */
  gap?: LengthPercentageInput
  /**
   * The cost of each corner, as a length: a route takes a detour up to this
   * long to save a corner.
   */
  bendCost?: LengthPercentageInput
  /**
   * The extra cost of each corner against an edge's preferred `turn`, as a
   * length.
   */
  turnCost?: LengthPercentageInput
  /** Which side of their edge adornments sit on: `'start'`, `'center'` (default), `'end'`, or a ratio. */
  alignAdornments?: RatioInput
  debug?: boolean
}

export const ConnectorLayout = defineComponent(
  (props: ConnectorLayoutProps, { expose }) => {
    const rect = useRect(props)

    useParentRectRegistration(rect)

    const clearance = useLengthPercentage(() => props.clearance, 0)
    const gap = useLengthPercentage(() => props.gap, 0)
    const bendCost = useLengthPercentage(() => props.bendCost, 0)
    const turnCost = useLengthPercentage(() => props.turnCost, 0)

    const layout = computed(() => {
      if (Connector.isConnector(props.layout)) {
        return props.layout
      }
      return Connector.make({
        clearance: clearance.value,
        gap: gap.value,
        bendCost: bendCost.value,
        turnCost: turnCost.value,
        alignAdornments: resolveRatio(props.alignAdornments, 0.5),
      })
    })

    useConnectorLayout(layout)

    expose({ rect, layout })

    return useGroupRenderer(rect, () => boolProp(props.debug))
  },
  {
    name: 'ConnectorLayout',
    props: [
      ...RECT_PROP_KEYS,
      'layout',
      'clearance',
      'gap',
      'bendCost',
      'turnCost',
      'alignAdornments',
      'debug',
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
