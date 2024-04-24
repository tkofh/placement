import type { ReadonlyRect } from 'placement/rect'
import {
  Fragment,
  type PropType,
  type SlotsType,
  type VNodeArrayChildren,
  computed,
  defineComponent,
  h,
  useAttrs,
  useSlots,
} from 'vue'
import { useFrame } from '../composables/useFrame'
import {
  frameInsetProps,
  frameSelfPropDefs,
  svgPaintPropDefs,
} from '../internal/props'
import type { Numberish } from '../internal/types'
import { svgPresentationAttributes } from '../utils/svgPresentationAttributes'

export const AbsoluteFrame = defineComponent({
  name: 'AbsoluteFrame',
  props: {
    ...frameSelfPropDefs,
    ...svgPaintPropDefs,
    ...frameInsetProps,
    rx: { type: [Number, String] as PropType<Numberish>, default: 0 },
    ry: { type: [Number, String] as PropType<Numberish>, default: 0 },
  },
  inheritAttrs: false,
  slots: Object as SlotsType<{
    default: Readonly<ReadonlyRect>
  }>,
  setup(props) {
    const rect = useFrame('absolute', props, false)
    const slots = useSlots()
    const attrs = useAttrs()
    const svgAttrs = svgPresentationAttributes(props)

    const shouldRender = computed(
      () =>
        Object.keys(attrs).length > 0 || Object.keys(svgAttrs.value).length > 0,
    )

    return () => {
      const children: VNodeArrayChildren = [
        // createCommentVNode(
        //   `<AbsoluteFrame x="${rect.value.x}" y="${rect.value.y}" width="${rect.value.width}" height="${rect.value.height}">`,
        // ),
        slots.default?.(rect.value),
        // createCommentVNode('</AbsoluteFrame>'),
      ]

      if (shouldRender.value) {
        children.unshift(
          h('rect', { ...attrs, ...svgAttrs.value, ...rect.value }),
        )
      }

      return h(Fragment, {}, children)
    }
  },
})
