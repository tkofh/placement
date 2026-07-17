import * as Point from 'placement/point'
import * as Rect from 'placement/rect'
import { computed, defineComponent, h, shallowRef } from 'vue'
import { useDomRect } from '../composables/useDomRect.ts'
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
} from '../composables/useRect.ts'
import { useSizingContextRoot } from '../composables/useSizingContext.ts'
import { autoDimensions, computedDimensions } from '../data/dimensions.ts'
import { provideShouldRenderGroups } from '../internal/render.ts'
import { boolProp } from '../internal/utils.ts'
import { useOrigin } from '../props/origin.ts'

export type FitInput = 'contain' | 'cover' | 'crop'

export interface GraphicRootProps extends SizeProps, TransformProps, OriginProps {
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
      Rect.fromDimensions(autoDimensions(size.value, domDimensions.value)),
    )

    const origin = useOrigin(() => props.origin, Point.half)
    const translation = useXYTranslation(props, domRect)

    const viewBox = computed(() => {
      const fit = props.fit ?? 'crop'
      let viewBoxRect: Rect.Rect
      if (fit === 'crop') {
        viewBoxRect = domRect.value.pipe(Rect.align(rootRect.value, origin.value))
      } else {
        viewBoxRect = domRect.value.pipe(
          // these are reversed (cover vs contain) because the viewBox is
          // the "parent" rect in this context. when the viewBox "covers"
          // the rootRect, then the rootRect is "contained" by the viewBox
          fit === 'cover' ? Rect.contain(rootRect.value, 0) : Rect.cover(rootRect.value, 0),
          Rect.align(rootRect.value, origin.value),
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
