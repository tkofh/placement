import type { Rect } from 'placement/rect'
import { type SlotsType, type VNode, defineComponent } from 'vue'
import { useHierarchyAdornment, useHierarchyPercentBasis } from '../composables/useHierarchy.ts'
import {
  EDGE_ADORNMENT_PROP_KEYS,
  type EdgeAdornmentOrient,
  type EdgeAdornmentProps,
  useEdgeAdornmentRenderer,
} from '../internal/adornmentComponent.ts'

export type HierarchyAdornmentOrient = EdgeAdornmentOrient

/** The props of `HierarchyAdornment` (see `EdgeAdornmentProps`). */
export type HierarchyAdornmentProps = EdgeAdornmentProps

export const HierarchyAdornment = defineComponent(
  (props: HierarchyAdornmentProps) =>
    useEdgeAdornmentRenderer(props, useHierarchyPercentBasis(), useHierarchyAdornment),
  {
    name: 'HierarchyAdornment',
    props: [...EDGE_ADORNMENT_PROP_KEYS],
    inheritAttrs: false,
    slots: {} as SlotsType<{
      default: (props: { rect: Rect }) => Array<VNode>
    }>,
  },
)
