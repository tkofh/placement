import { dimensions } from 'placement/dimensions'
import { point } from 'placement/point'
import { computed, defineComponent, h } from 'vue'
import {
  PAINT_PROP_KEYS,
  type PaintProps,
  usePaint,
} from '../composables/usePaint'
import {
  RADIUS_PROP_KEYS,
  type RadiusProps,
  useRadius,
} from '../composables/useRadius'
import {
  RECT_PROP_KEYS,
  type RectProps,
  useAxisInterval,
  useBasisSize,
  useMaxSize,
  useMinSize,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext'
import { useLengthPercentage } from '../props/lengthPercentage'
import { useOrigin } from '../props/origin'

export interface GraphicCircleProps
  extends PaintProps,
    RectProps,
    RadiusProps {}

export const GraphicCircle = defineComponent(
  (props: GraphicCircleProps) => {
    const basisSize = useBasisSize(props)
    const minSize = useMinSize(props)
    const maxSize = useMaxSize(props)

    const top = useLengthPercentage(
      () => props.top,
      Number.POSITIVE_INFINITY,
      'height',
    )
    const right = useLengthPercentage(
      () => props.right,
      Number.POSITIVE_INFINITY,
      'width',
    )
    const bottom = useLengthPercentage(
      () => props.bottom,
      Number.POSITIVE_INFINITY,
      'height',
    )
    const left = useLengthPercentage(
      () => props.left,
      Number.POSITIVE_INFINITY,
      'width',
    )

    const radius = useRadius(props, point.infinity)

    const parentX = useParentX()
    const parentY = useParentY()
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()

    const size = computed(() =>
      radius.value === point.infinity
        ? basisSize.value
        : dimensions(radius.value.x * 2, radius.value.y * 2),
    )

    const x = useAxisInterval(
      left,
      right,
      () => size.value.width,
      parentX,
      parentWidth,
      () => minSize.value.width,
      () => maxSize.value.width,
    )

    const y = useAxisInterval(
      top,
      bottom,
      () => size.value.height,
      parentY,
      parentHeight,
      () => minSize.value.height,
      () => maxSize.value.height,
    )

    const origin = useOrigin(
      () => props.origin,
      () => (radius.value === point.infinity ? point.zero : point.half),
    )

    const _rx = computed(() => x.value.size * 0.5)
    const _cx = computed(
      () => x.value.start + _rx.value - origin.value.x * x.value.size,
    )
    const _ry = computed(() => y.value.size * 0.5)
    const _cy = computed(
      () => y.value.start + _ry.value - origin.value.y * y.value.size,
    )

    const paint = usePaint(props)

    return () => {
      const rx = _rx.value
      const cx = _cx.value
      const ry = _ry.value
      const cy = _cy.value
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
