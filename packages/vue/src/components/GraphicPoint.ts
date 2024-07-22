import { point } from 'placement/point'
import { auto } from 'placement/utils'
import { computed, defineComponent } from 'vue'
import { usePoint } from '../composables/usePointList'
import {
  INDIVIDUAL_INSET_PROP_KEYS,
  type IndividualInsetProps,
  TRANSLATE_PROP_KEYS,
  type TranslateProps,
  useInset,
} from '../composables/useRect'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
  useRootHeight,
  useRootWidth,
} from '../composables/useSizingContext'
import { resolveSize1D } from '../internal/props/size1d'
import { boolProp } from '../internal/utils'

interface GraphicPointProps extends IndividualInsetProps, TranslateProps {
  global?: boolean
}

export const GraphicPoint = defineComponent(
  (props: GraphicPointProps) => {
    const { top, right, bottom, left } = useInset(props)

    const parentX = useParentX()
    const parentY = useParentY()
    const parentWidth = useParentWidth()
    const parentHeight = useParentHeight()
    const rootWidth = useRootWidth()
    const rootHeight = useRootHeight()

    const offsetX = computed(() => (boolProp(props.global) ? parentX.value : 0))
    const offsetY = computed(() => (boolProp(props.global) ? parentY.value : 0))

    const translateX = computed(() =>
      resolveSize1D(
        props.x,
        0,
        parentWidth.value,
        rootWidth.value,
        rootHeight.value,
      ),
    )
    const translateY = computed(() =>
      resolveSize1D(
        props.y,
        0,
        parentHeight.value,
        rootWidth.value,
        rootHeight.value,
      ),
    )

    usePoint(() => {
      const x = auto(left.value, parentHeight.value - right.value, 0)
      const y = auto(top.value, parentWidth.value - bottom.value, 0)

      return point(
        x + offsetX.value + translateX.value,
        y + offsetY.value + translateY.value,
      )
    })

    return () => null
  },
  {
    name: 'GraphicPoint',
    props: [...INDIVIDUAL_INSET_PROP_KEYS, ...TRANSLATE_PROP_KEYS, 'global'],
  },
)
