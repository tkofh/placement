import { type Point, isPoint, point } from 'placement/point'
import { type Rect, align, contain, cover, rect } from 'placement/rect'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { useDomRect } from '../composables/useDomRect'
import { provideParentRect } from '../composables/useParentRect'
import { provideRootRect } from '../composables/useRootRect'
import { type Sizeable, useSize } from '../composables/useSize'
import type { FitInput } from '../internal/props/fit'
import { type OriginInput, parseOrigin } from '../internal/props/origin'

export interface GraphicRootProps extends Sizeable {
  origin?: OriginInput | Point | number
  fit?: FitInput
}

export const GraphicRoot = defineComponent(
  (props: GraphicRootProps, { slots }) => {
    const svg = shallowRef<SVGElement>()
    const domRect = useDomRect(svg)

    const size = useSize(props, domRect, domRect)

    const rootRect = computed(() => rect.fromDimensions(size.value))

    const origin = computed(() =>
      props.origin == null
        ? point(0)
        : isPoint(props.origin)
          ? props.origin
          : typeof props.origin === 'number'
            ? point(props.origin)
            : parseOrigin(props.origin),
    )

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
    props: [
      'aspectRatio',
      'width',
      'height',
      'minWidth',
      'minHeight',
      'maxWidth',
      'maxHeight',
      'minSize',
      'maxSize',
      'size',
      'origin',
      'fit',
    ],
  },
)
