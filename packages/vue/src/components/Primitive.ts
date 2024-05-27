import type { ReadonlyRect } from 'placement/rect'
import { type PropType, computed, defineComponent, h } from 'vue'
import { useRadiusX, useRadiusY } from '../composables/properties/radius'
import { useRootRect } from '../composables/useRootRect'
import { svgPaintPropDefs, svgRadiusPropDefs } from '../internal/props'

const keyAliases = {
  fillOpacity: 'fill-opacity',
  fillRule: 'fill-rule',
  strokeWidth: 'stroke-width',
  strokeLinecap: 'stroke-linecap',
  strokeLinejoin: 'stroke-linejoin',
  strokeMiterlimit: 'stroke-miterlimit',
  strokeDasharray: 'stroke-dasharray',
  strokeDashoffset: 'stroke-dashoffset',
  strokeOpacity: 'stroke-opacity',
} as const
function getKey(key: string) {
  if (key in keyAliases) {
    return keyAliases[key as keyof typeof keyAliases]
  }
  return key
}

const props = {
  ...svgPaintPropDefs,
  ...svgRadiusPropDefs,
  rect: { type: Object as PropType<ReadonlyRect>, required: true },
} as const

const propKeys = new Set(Object.keys(props))

export const Primitive = defineComponent({
  name: 'Primitive',
  inheritAttrs: false,
  props,
  setup(props) {
    const rootRect = useRootRect()

    const rx = useRadiusX(
      () => props.rx,
      () => props.r,
      () => props.rect as ReadonlyRect,
      rootRect,
    )
    const ry = useRadiusY(
      () => props.ry,
      () => props.r,
      () => props.rect as ReadonlyRect,
      rootRect,
    )

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: will be simpler soon
    const state = computed(() => {
      // biome-ignore lint/suspicious/noExplicitAny: general prop container
      const attrs: Record<string, any> = {}

      let willRender = false
      for (const key of propKeys) {
        const value = props[key as keyof typeof props]
        if (
          ((key === 'fill' || key === 'stroke') &&
            !(value === false || value === 'none')) ||
          (key !== 'fill' &&
            key !== 'stroke' &&
            value !== undefined &&
            value !== null)
        ) {
          willRender = true
        }

        if (key === 'fill') {
          attrs.fill = value === false ? 'none' : value
        } else if (key === 'stroke') {
          attrs.stroke = value === false ? 'none' : value
        } else if (key === 'rx') {
          attrs.rx = rx.value !== 0 ? rx.value : undefined
        } else if (key === 'ry') {
          attrs.ry = ry.value !== 0 ? ry.value : undefined
        } else if (key === 'rect') {
          const { x, y, width, height } = value as ReadonlyRect
          attrs.x = x
          attrs.y = y
          attrs.width = width
          attrs.height = height
        } else if (key !== 'rx' && key !== 'ry' && key !== 'r') {
          attrs[getKey(key)] = value
        }
      }

      attrs.rx = rx.value !== 0 ? rx.value : undefined
      attrs.ry = ry.value !== 0 ? ry.value : undefined

      return { willRender, attrs }
    })

    return () => {
      return state.value.willRender ? h('rect', state.value.attrs) : null
    }
  },
})
