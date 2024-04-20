import type { ReadonlyRect } from 'placement/Box'
import {
  type PropType,
  type SlotsType,
  computed,
  defineComponent,
  h,
  shallowRef,
} from 'vue'
import { useDomRect } from '../composables/useDomRect'
import { useRootFrame } from '../composables/useRootFrame'
import { useViewportRect } from '../composables/useViewportRect'

export const GraphicRoot = defineComponent({
  name: 'RootFrame',
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  props: {
    width: { type: [String, Number], required: false },
    height: { type: [String, Number], required: false },
    aspectRatio: { type: [String, Number], required: false },
    fit: {
      type: String as PropType<'fill' | 'cover' | 'contain'>,
      default: 'contain',
    },
    originX: { type: [String, Number], default: '50%' },
    originY: { type: [String, Number], default: '50%' },
  },
  setup(props, { slots }) {
    const svg = shallowRef<SVGElement>()

    const domRect = useDomRect(svg)

    const root = useRootFrame(() => ({
      width: props.width,
      height: props.height,
      aspectRatio: props.aspectRatio,
    }))

    const viewportRect = useViewportRect(
      domRect,
      root,
      () => props.fit,
      () => props.originX,
      () => props.originY,
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
