import { point, translate } from 'placement/point'
import { Fragment, computed, defineComponent, h } from 'vue'
import {
  STROKE_PROP_KEYS,
  type StrokeProps,
  usePaint,
} from '../composables/usePaint'
import { usePointList } from '../composables/usePointList'
import { useParentX, useParentY } from '../composables/useSizingContext'

interface GraphicLineProps extends StrokeProps {}

export const GraphicLine = defineComponent(
  (props: GraphicLineProps, { slots, attrs }) => {
    const points = usePointList()

    const parentX = useParentX()
    const parentY = useParentY()

    const translation = computed(() => translate(parentX.value, parentY.value))

    const start = computed(() =>
      (points.value[0] ?? point.zero).pipe(translation.value),
    )
    const end = computed(() =>
      (points.value[1] ?? point.zero).pipe(translation.value),
    )

    const paint = usePaint(props)

    return () => {
      return h(Fragment, {}, [
        slots.default?.(),
        h('line', {
          x1: start.value.x,
          y1: start.value.y,
          x2: end.value.x,
          y2: end.value.y,
          ...attrs,
          ...paint.value,
        }),
      ])
    }
  },
  {
    name: 'GraphicLine',
    props: [...STROKE_PROP_KEYS],
    inheritAttrs: false,
  },
)
