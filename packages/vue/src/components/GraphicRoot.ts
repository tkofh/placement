import type { Rect } from 'placement/Rect'
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
import { normalizeDimensionOptions } from '../utils/normalizeDimensionOptions'

export const GraphicRoot = defineComponent({
  name: 'RootFrame',
  slots: Object as SlotsType<{
    default: Readonly<Rect>
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
    const svg = shallowRef()

    const domRect = useDomRect(svg)

    const root = useRootFrame(() => {
      const { width, height } = normalizeDimensionOptions(
        props.width,
        props.height,
        props.aspectRatio,
      )

      return {
        width:
          typeof width === 'function'
            ? width(domRect.value, domRect.value)
            : width,
        height:
          typeof height === 'function'
            ? height(domRect.value, domRect.value)
            : height,
      }
    })

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
