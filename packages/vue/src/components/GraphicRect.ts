import type { Dimensions } from 'placement/dimensions'
import { type Point, isPoint, point } from 'placement/point'
import type { Rect } from 'placement/rect'
import { computed, defineComponent, h, toRef, toValue } from 'vue'
import { type Paintable, usePaint } from '../composables/usePaint'
import { useParentRect } from '../composables/useParentRect'
import { type Positionable, useRect } from '../composables/useRect'
import { useRootRect } from '../composables/useRootRect'
import { type RadiusInput, parseRadius } from '../internal/props/radius'

export interface GraphicRectProps extends Paintable, Positionable {
  r?: RadiusInput | Point | number
}

function resolveRadius(
  r: RadiusInput | Point | number | undefined,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
): Point {
  if (r === undefined) {
    return point.zero
  }

  if (typeof r === 'number') {
    return point(r, r)
  }

  if (isPoint(r)) {
    return r
  }

  return parseRadius(r, parent, root)
}

export const GraphicRect = defineComponent(
  (props: GraphicRectProps, { slots }) => {
    const parentRect = useParentRect()
    const rootRect = useRootRect()

    const self = useRect(props, parentRect, rootRect)

    const radiusProp = toRef(props, 'r')
    const radius = computed(() =>
      resolveRadius(radiusProp.value, toValue(parentRect), toValue(rootRect)),
    )

    const paint = usePaint(props, parentRect, rootRect)

    return () => {
      return h(
        'rect',
        {
          x: self.value.x,
          y: self.value.y,
          width: self.value.width,
          height: self.value.height,
          rx: radius.value.x,
          ry: radius.value.y,
          ...paint.value,
        },
        slots.default?.(),
      )
    }
  },
  {
    name: 'GraphicRect',
    props: [
      'width',
      'height',
      'aspectRatio',
      'size',
      'maxSize',
      'maxWidth',
      'maxHeight',
      'minSize',
      'minWidth',
      'minHeight',
      'opacity',
      'fill',
      'stroke',
      'r',
      'top',
      'right',
      'bottom',
      'left',
      'inset',
      'origin',
    ],
  },
)
