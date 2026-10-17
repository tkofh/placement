import * as Connector from 'placement/connector'
import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, computed, defineComponent } from 'vue'
import { useConnectorLayout } from '../composables/useConnector.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'
import { useParentRectRegistration } from '../composables/useSizingContext.ts'
import { keywordResults } from '../internal/props/justifyContent.ts'
import { type RatioInput, resolveRatio } from '../internal/props/ratio.ts'
import { useGroupRenderer } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { type JustifyContentInput, useJustifyContent } from '../props/justifyContent.ts'
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
  /**
   * Which side of their edge adornments sit on, as `alignItems` places flex
   * items across the line: `'start'`, `'center'` (default), `'end'`, or a
   * ratio.
   */
  alignAdornments?: RatioInput
  /**
   * Where each straight run of an edge puts the flow adornments between its
   * ends, as `justifyContent` places flex items along a run that points
   * toward the target: `'start'`, `'center'` (default), `'end'`,
   * `'space-between'`, `'space-around'`, `'space-evenly'`, or the `place`
   * and `space` forms that `FlexLayout` takes. The adornments keep clear of
   * the run's corners where they have room.
   */
  justifyAdornments?: JustifyContentInput
  /**
   * The distance between flow adornments next to each other on a run, on
   * top of their margins. Percentages resolve against the width of the
   * layout's parent.
   */
  adornmentGap?: LengthPercentageInput
  /**
   * Where a jog, the rise of a Z-shaped route, sits along the run it
   * shifts: `'start'` (the source end), `'center'` (default), `'end'` (the
   * target end), or a ratio. Nodes, and routes that cross only part of
   * the jog, may hold it back. An edge's own `jogAt` overrides it.
   */
  jogAt?: RatioInput
  /**
   * How a jog too short for its two corners crosses over: instead of
   * shrinking the corners into a kink, they slide apart and turn less than
   * a right angle, into an S. `1` (default) spans what the full corners
   * would, larger values stretch the S longer and gentler where there is
   * room, and `0` keeps jogs upright.
   */
  jogSlant?: number
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
    const adornmentGap = useLengthPercentage(() => props.adornmentGap, 0)
    const justify = useJustifyContent(() => props.justifyAdornments, keywordResults.center)

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
        justifyAdornments: justify.value.justifyContent,
        justifyAdornmentsSpace: justify.value.justifyContentSpace,
        justifyAdornmentsSpaceOuter: justify.value.justifyContentSpaceOuter,
        adornmentGap: adornmentGap.value,
        jogAt: resolveRatio(props.jogAt, 0.5),
        jogSlant: props.jogSlant,
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
      'justifyAdornments',
      'adornmentGap',
      'jogAt',
      'jogSlant',
      'debug',
    ],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
