import * as Dimensions from 'placement/dimensions'
import * as Point from 'placement/point'
import { computed, defineComponent, h } from 'vue'
import { PAINT_PROP_KEYS, type PaintProps, usePaint } from '../composables/usePaint.ts'
import { RADIUS_PROP_KEYS, type RadiusProps, useRadius } from '../composables/useRadius.ts'
import { RECT_PROP_KEYS, type RectProps, useRect } from '../composables/useRect.ts'

export interface GraphicCircleProps extends PaintProps, RectProps, RadiusProps {}

export const GraphicCircle = defineComponent(
  (props: GraphicCircleProps) => {
    const radius = useRadius(props, Point.infinity)

    // A set radius overrides the sizing props and recenters the default
    // origin. The inset props then position the center, not the corner.
    const size = computed(() =>
      radius.value === Point.infinity
        ? undefined
        : Dimensions.make(radius.value.x * 2, radius.value.y * 2),
    )

    const self = useRect(props, {
      size,
      origin: () => (radius.value === Point.infinity ? Point.zero : Point.half),
    })

    const paint = usePaint(props)

    return () => {
      const { center, width, height } = self.value
      const cx = center.x
      const cy = center.y
      const rx = width * 0.5
      const ry = height * 0.5
      const isEllipse = rx !== ry
      return h(
        isEllipse ? 'ellipse' : 'circle',
        isEllipse
          ? {
              cx,
              cy,
              rx,
              ry,
              ...paint.value,
            }
          : {
              cx,
              cy,
              r: rx,
              ...paint.value,
            },
      )
    }
  },
  {
    name: 'GraphicCircle',
    props: [...RECT_PROP_KEYS, ...RADIUS_PROP_KEYS, ...PAINT_PROP_KEYS],
  },
)
