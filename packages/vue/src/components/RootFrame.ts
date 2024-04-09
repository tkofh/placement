import {
  type PropType,
  computed,
  defineComponent,
  h,
  shallowRef,
  useSlots,
} from 'vue'
import { useDomRect } from '../composables/useDomRect.ts'
import { useRootFrame } from '../composables/useFrame.ts'
import { useViewportRect } from '../composables/useViewportRect.ts'
import { normalizeDimensionOptions } from '../utils/normalizeDimensionOptions.ts'

export const RootFrame = defineComponent({
  name: 'RootFrame',
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
  setup(props) {
    const svg = shallowRef<SVGElement>()

    const domRect = useDomRect(svg)

    const root = useRootFrame(() => {
      const { width, height } = normalizeDimensionOptions(
        props.width,
        props.height,
        props.aspectRatio,
      )

      console.log('width', width)
      console.log('height', height)

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

    const slots = useSlots()

    return () => {
      return h(
        'svg',
        {
          ref: svg,
          style: {
            width: '900',
            height: '450',
            border: '1px solid white',
            overflow: 'visible',
            maxWidth: '100%',
            minWidth: '0',
          },
          preserveAspectRatio: 'none',
          viewBox: viewBox.value,
        },
        [
          h('rect', {
            x: root.value.x,
            y: root.value.y,
            width: root.value.width,
            height: root.value.height,
            fill: 'red',
          }),
          ...(slots.default ? slots.default() : []),
        ],
      )
    }
  },
})
