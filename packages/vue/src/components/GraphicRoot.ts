import type { Point } from 'placement/point'
import { type Rect, align, contain, cover, rect } from 'placement/rect'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { useDomRect } from '../composables/useDomRect'
import { provideParentRect } from '../composables/useParentRect'
import {
  ORIGIN_PROP_KEYS,
  SIZE_PROP_KEYS,
  type SizeProps,
  type TransformProps,
  useOrigin,
  useSize,
  useXYTranslation,
} from '../composables/useRect'
import { provideRootRect } from '../composables/useRootRect'
import type { FitInput } from '../internal/props/fit'
import type { OriginInput } from '../internal/props/origin'

export interface GraphicRootProps extends SizeProps, TransformProps {
  origin?: OriginInput | Point | number
  fit?: FitInput
}

export const GraphicRoot = defineComponent(
  (props: GraphicRootProps, { slots }) => {
    const svg = shallowRef<SVGElement>()
    const domRect = useDomRect(svg)

    const size = useSize(props, domRect, domRect)

    const rootRect = computed(() => rect.fromDimensions(size.value))

    const origin = useOrigin(props)
    const translation = useXYTranslation(props, domRect)

    const viewBox = computed(() => {
      const fit = props.fit ?? 'crop'
      let viewBoxRect: Rect
      if (fit === 'crop') {
        viewBoxRect = domRect.value.pipe(align(rootRect.value, origin.value))
      } else {
        viewBoxRect = domRect.value.pipe(
          // these are reversed (cover vs contain) because the viewBox is
          // the "parent" rect in this context. when the viewBox "covers"
          // the rootRect, then the rootRect is "contained" by the viewBox
          fit === 'cover'
            ? contain(rootRect.value, 0)
            : cover(rootRect.value, 0),
          align(rootRect.value, origin.value),
        )
      }

      viewBoxRect = translation.value(viewBoxRect)

      return `${viewBoxRect.x} ${viewBoxRect.y} ${viewBoxRect.width} ${viewBoxRect.height}`
    })

    provideRootRect(rootRect)
    provideParentRect(rootRect)

    return () => {
      return h(
        'svg',
        { ref: svg, viewBox: viewBox.value, preserveAspectRatio: 'none' },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicRoot',
    props: [...SIZE_PROP_KEYS, ...ORIGIN_PROP_KEYS, 'fit'],
  },
)
