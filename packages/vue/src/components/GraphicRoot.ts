import { point } from 'placement/point'
import { type Rect, align, contain, cover, rect } from 'placement/rect'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { useDomRect } from '../composables/useDomRect'
import {
  ORIGIN_PROP_KEYS,
  type OriginProps,
  SIZE_PROP_KEYS,
  type SizeProps,
  type TransformProps,
  useBasisSize,
  useConstrainedSize,
  useMaxSize,
  useMinSize,
  useXYTranslation,
} from '../composables/useRect'
import { useSizingContextRoot } from '../composables/useSizingContext'
import { autoDimensions, computedDimensions } from '../data/dimensions'
import type { FitInput } from '../internal/props/fit'
import { provideShouldRenderGroups } from '../internal/render'
import { boolProp } from '../internal/utils'
import { useOrigin } from '../props/origin'

export interface GraphicRootProps
  extends SizeProps,
    TransformProps,
    OriginProps {
  fit?: FitInput
  debugGroups?: boolean
}

export const GraphicRoot = defineComponent(
  (props: GraphicRootProps, { slots }) => {
    const svg = shallowRef<SVGElement>()
    const domRect = useDomRect(svg)
    const domDimensions = computedDimensions(
      () => domRect.value.width,
      () => domRect.value.height,
    )

    const basisSize = useBasisSize(props, domDimensions)
    const minSize = useMinSize(props, domDimensions)
    const maxSize = useMaxSize(props, domDimensions)

    const size = useConstrainedSize(basisSize, minSize, maxSize)

    const rootRect = computed(() =>
      rect.fromDimensions(autoDimensions(size.value, domDimensions.value)),
    )

    const origin = useOrigin(() => props.origin, point.half)
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

    useSizingContextRoot(rootRect)

    provideShouldRenderGroups(() => (boolProp(props.debugGroups) ? 2 : 0))

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
    props: [...SIZE_PROP_KEYS, ...ORIGIN_PROP_KEYS, 'fit', 'debugGroups'],
  },
)
