import type { ReadonlyRect } from 'placement/rect'
import {
  type PropType,
  type SlotsType,
  computed,
  defineComponent,
  h,
  shallowRef,
} from 'vue'
import { useDomRect } from '../composables/useDomRect'
import type { OriginXInput, OriginYInput } from '../composables/useProperty'
import { useRootFrame } from '../composables/useRootFrame'
import { useViewportRect } from '../composables/useViewportRect'
import { frameSizingPropDefs } from '../internal/props'
import type { FrameFit } from '../internal/types'

const rootFramePropDefs = {
  ...frameSizingPropDefs,
  fit: { type: String as PropType<FrameFit>, default: 'contain' },
  originX: { type: String as PropType<OriginXInput>, default: '50%' },
  originY: { type: String as PropType<OriginYInput>, default: '50%' },
} as const

export const RootFrame = defineComponent({
  name: 'RootFrame',
  props: rootFramePropDefs,
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  setup(props, { slots }) {
    const svg = shallowRef<SVGElement>()

    const domRect = useDomRect(svg)

    const root = useRootFrame(domRect, props)

    const viewportRect = useViewportRect(
      domRect,
      root,
      () => props.fit ?? 'contain',
      () => props.originX ?? '50%',
      () => props.originY ?? '50%',
    )
    const viewBox = computed(
      () =>
        `${viewportRect.value.x} ${viewportRect.value.y} ${viewportRect.value.width} ${viewportRect.value.height}`,
    )

    return () => {
      return h(
        'svg',
        {
          ref: svg,
          preserveAspectRatio: 'none',
          viewBox: viewBox.value,
        },
        slots.default?.(root.value),
      )
    }
  },
})
