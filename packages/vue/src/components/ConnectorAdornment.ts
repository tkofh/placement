import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { useConnectorAdornment } from '../composables/useConnector.ts'
import {
  EDGE_ADORNMENT_PROP_KEYS,
  type EdgeAdornmentOrient,
  type EdgeAdornmentProps,
  useEdgeAdornmentRenderer,
} from '../internal/adornmentComponent.ts'

export type ConnectorAdornmentOrient = EdgeAdornmentOrient

/**
 * The props of `ConnectorAdornment` (see `EdgeAdornmentProps`). Sizes and
 * margins resolve percentages against the edge's parent.
 */
export type ConnectorAdornmentProps = EdgeAdornmentProps

export const ConnectorAdornment = defineComponent(
  (props: ConnectorAdornmentProps) =>
    useEdgeAdornmentRenderer(props, undefined, useConnectorAdornment),
  {
    name: 'ConnectorAdornment',
    props: [...EDGE_ADORNMENT_PROP_KEYS],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
