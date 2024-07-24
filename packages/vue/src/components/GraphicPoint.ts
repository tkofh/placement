import { point } from 'placement/point'
import { auto } from 'placement/utils'
import { computed, defineComponent } from 'vue'
import { usePoint } from '../composables/usePointList'
import {
  INSET_PROP_KEYS,
  type InsetProps,
  TRANSLATE_PROP_KEYS,
  type TranslateProps,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
} from '../composables/useSizingContext'
import { resolveSize1D } from '../internal/props/size1d'
import { boolProp } from '../internal/utils'
import { useLengthPercentage } from '../props/lengthPercentage'

interface GraphicPointProps extends InsetProps, TranslateProps {
  global?: boolean
}

export const GraphicPoint = defineComponent(
  (props: GraphicPointProps) => {
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

    const parentX = useParentX()
    const parentY = useParentY()
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()

    const offsetX = computed(() => (boolProp(props.global) ? parentX.value : 0))
    const offsetY = computed(() => (boolProp(props.global) ? parentY.value : 0))

    const translateX = computed(() =>
      resolveSize1D(props.x, 0, parentWidth.value),
    )
    const translateY = computed(() =>
      resolveSize1D(props.y, 0, parentHeight.value),
    )

    usePoint(() => {
      const x = auto(left.value, parentWidth.value - right.value, 0)
      const y = auto(top.value, parentHeight.value - bottom.value, 0)

      return point(
        x + offsetX.value + translateX.value,
        y + offsetY.value + translateY.value,
      )
    })

    return () => null
  },
  {
    name: 'GraphicPoint',
    props: [...INSET_PROP_KEYS, ...TRANSLATE_PROP_KEYS, 'global'],
  },
)
