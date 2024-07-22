import {
  type Dimensions,
  type DimensionsLike,
  clamp as clampDimensions,
  dimensions,
} from 'placement/dimensions'
import { interval } from 'placement/interval'
import { offset } from 'placement/offset'
import { type Point, isPoint, point } from 'placement/point'
import { type Rect, align, rect, translate } from 'placement/rect'
import { auto, clamp } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AspectRatioInput,
  resolveAspectRatio,
} from '../internal/props/aspectRatio'
import { type InsetInput, resolveInset } from '../internal/props/inset'
import { type OriginInput, resolveOrigin } from '../internal/props/origin'
import { type Size1DInput, resolveSize1D } from '../internal/props/size1d'
import { type Size2DInput, resolveSize2D } from '../internal/props/size2d'
import {
  useParentHeight,
  useParentWidth,
  useParentX,
  useParentY,
  useRootHeight,
  useRootWidth,
} from './useSizingContext'

export interface MinSizeProps {
  minWidth?: Size1DInput | number | undefined
  minHeight?: Size1DInput | number | undefined
  minSize?: Size2DInput | Dimensions | number | undefined
}

export const MIN_SIZE_PROP_KEYS = ['minSize', 'minWidth', 'minHeight'] as const

export interface MaxSizeProps {
  maxWidth?: Size1DInput | number | undefined
  maxHeight?: Size1DInput | number | undefined
  maxSize?: Size2DInput | Dimensions | number | undefined
}

export const MAX_SIZE_PROP_KEYS = ['maxSize', 'maxWidth', 'maxHeight'] as const

export interface BasisSizeProps {
  size?: Size2DInput | Dimensions | number | undefined
  width?: Size1DInput | number | undefined
  height?: Size1DInput | number | undefined
  aspectRatio?: AspectRatioInput | number | undefined
}

export const BASIS_SIZE_PROP_KEYS = [
  'size',
  'width',
  'height',
  'aspectRatio',
] as const

export interface SizeProps extends MinSizeProps, MaxSizeProps, BasisSizeProps {}

export const SIZE_PROP_KEYS = [
  ...MIN_SIZE_PROP_KEYS,
  ...MAX_SIZE_PROP_KEYS,
  ...BASIS_SIZE_PROP_KEYS,
] as const

export interface IndividualInsetProps {
  top?: Size1DInput | number
  right?: Size1DInput | number
  bottom?: Size1DInput | number
  left?: Size1DInput | number
}

export const INDIVIDUAL_INSET_PROP_KEYS = [
  'top',
  'right',
  'bottom',
  'left',
] as const

export interface InsetProps extends IndividualInsetProps {
  inset?: InsetInput | Point | number
}

export const INSET_PROP_KEYS = [...INDIVIDUAL_INSET_PROP_KEYS, 'inset'] as const

export interface OriginProps {
  origin?: OriginInput | Point | number
}

export const ORIGIN_PROP_KEYS = ['origin'] as const

export interface TranslateProps {
  x?: Size1DInput | number
  y?: Size1DInput | number
}

export const TRANSLATE_PROP_KEYS = ['x', 'y'] as const

export interface TransformProps extends OriginProps, TranslateProps {}

export const TRANSFORM_PROP_KEYS = [
  ...ORIGIN_PROP_KEYS,
  ...TRANSLATE_PROP_KEYS,
] as const

export interface RectProps extends InsetProps, SizeProps, TransformProps {}

export const RECT_PROP_KEYS = [
  ...SIZE_PROP_KEYS,
  ...INSET_PROP_KEYS,
  ...TRANSFORM_PROP_KEYS,
] as const

function calculateSize(
  parentWidth: number,
  parentHeight: number,
  rootWidth: number,
  rootHeight: number,
  auto: number,
  size: Size2DInput,
  width: Size1DInput,
  height: Size1DInput,
  aspectRatio: AspectRatioInput,
) {
  const sizeProp = resolveSize2D(
    size,
    dimensions.infinity,
    parentWidth,
    parentHeight,
    rootWidth,
    rootHeight,
  )

  if (Number.isFinite(sizeProp.width) && Number.isFinite(sizeProp.height)) {
    return sizeProp
  }

  const widthProp = resolveSize1D(
    width,
    Number.POSITIVE_INFINITY,
    parentWidth,
    rootWidth,
    rootHeight,
  )

  const heightProp = resolveSize1D(
    height,
    Number.POSITIVE_INFINITY,
    parentHeight,
    rootWidth,
    rootHeight,
  )

  if (Number.isFinite(widthProp) && Number.isFinite(heightProp)) {
    return dimensions(widthProp, heightProp)
  }

  const aspectRatioProp =
    typeof aspectRatio === 'number'
      ? aspectRatio
      : resolveAspectRatio(aspectRatio)

  if (Number.isFinite(widthProp) && Number.isFinite(aspectRatioProp)) {
    return dimensions(widthProp, widthProp / aspectRatioProp)
  }

  if (Number.isFinite(aspectRatioProp) && Number.isFinite(heightProp)) {
    return dimensions(heightProp * aspectRatioProp, heightProp)
  }

  return dimensions(
    Number.isFinite(widthProp) ? widthProp : auto,
    Number.isFinite(heightProp) ? heightProp : auto,
  )
}

export function useBasisSize(
  input: MaybeRefOrGetter<BasisSizeProps>,
  overrideParent: MaybeRefOrGetter<DimensionsLike> | undefined = undefined,
  overrideRoot: MaybeRefOrGetter<DimensionsLike> | undefined = overrideParent,
): ComputedRef<Dimensions> {
  const parentWidth =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).width)
      : useParentWidth()
  const parentHeight =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).height)
      : useParentHeight()
  const rootWidth =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).width)
      : useRootWidth()
  const rootHeight =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).height)
      : useRootHeight()

  return computed(() => {
    const { size, width, height, aspectRatio } = toValue(input)

    return calculateSize(
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
      0,
      size,
      width,
      height,
      aspectRatio,
    )
  })
}

export function useMinSize(
  input: MaybeRefOrGetter<MinSizeProps>,
  overrideParent: MaybeRefOrGetter<DimensionsLike> | undefined = undefined,
  overrideRoot: MaybeRefOrGetter<DimensionsLike> | undefined = overrideParent,
): ComputedRef<Dimensions> {
  const parentWidth =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).width)
      : useParentWidth()
  const parentHeight =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).height)
      : useParentHeight()
  const rootWidth =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).width)
      : useRootWidth()
  const rootHeight =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).height)
      : useRootHeight()

  return computed(() => {
    const { minSize, minWidth, minHeight } = toValue(input)

    return calculateSize(
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
      0,
      minSize,
      minWidth,
      minHeight,
      Number.POSITIVE_INFINITY,
    )
  })
}

export function useMaxSize(
  input: MaybeRefOrGetter<MaxSizeProps>,
  overrideParent: MaybeRefOrGetter<DimensionsLike> | undefined = undefined,
  overrideRoot: MaybeRefOrGetter<DimensionsLike> | undefined = overrideParent,
): ComputedRef<Dimensions> {
  const parentWidth =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).width)
      : useParentWidth()
  const parentHeight =
    overrideParent !== undefined
      ? computed(() => toValue(overrideParent).height)
      : useParentHeight()
  const rootWidth =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).width)
      : useRootWidth()
  const rootHeight =
    overrideRoot !== undefined
      ? computed(() => toValue(overrideRoot).height)
      : useRootHeight()

  return computed(() => {
    const { maxSize, maxWidth, maxHeight } = toValue(input)

    return calculateSize(
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
      Number.POSITIVE_INFINITY,
      maxSize,
      maxWidth,
      maxHeight,
      Number.POSITIVE_INFINITY,
    )
  })
}

export function useConstrainedSize(
  basis: MaybeRefOrGetter<Dimensions>,
  min: MaybeRefOrGetter<Dimensions>,
  max: MaybeRefOrGetter<Dimensions>,
): ComputedRef<Dimensions> {
  return computed(() =>
    clampDimensions(toValue(basis), toValue(min), toValue(max)),
  )
}

// export function useSize(input: MaybeRefOrGetter<SizeProps>) {
//   const basis = useBasisSize(input)
//   const min = useMinSize(input)
//   const max = useMaxSize(input)
//
//   return useConstrainedSize(basis, min, max)
// }

export function useInset(props: MaybeRefOrGetter<InsetProps>): {
  readonly top: ComputedRef<number>
  readonly right: ComputedRef<number>
  readonly bottom: ComputedRef<number>
  readonly left: ComputedRef<number>
} {
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()
  const rootWidth = useRootWidth()
  const rootHeight = useRootHeight()

  const top = computed(() =>
    resolveSize1D(
      toValue(props).top,
      Number.POSITIVE_INFINITY,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )
  const right = computed(() =>
    resolveSize1D(
      toValue(props).right,
      Number.POSITIVE_INFINITY,
      parentWidth.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )
  const bottom = computed(() =>
    resolveSize1D(
      toValue(props).bottom,
      Number.POSITIVE_INFINITY,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )
  const left = computed(() =>
    resolveSize1D(
      toValue(props).left,
      Number.POSITIVE_INFINITY,
      parentWidth.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )

  const inset = computed(() =>
    resolveInset(
      toValue(props).inset,
      offset.infinity,
      parentWidth.value,
      parentHeight.value,
      rootWidth.value,
      rootHeight.value,
    ),
  )

  return {
    top: computed(() =>
      auto(top.value, inset.value.top, Number.POSITIVE_INFINITY),
    ),
    right: computed(() =>
      auto(right.value, inset.value.right, Number.POSITIVE_INFINITY),
    ),
    bottom: computed(() =>
      auto(bottom.value, inset.value.bottom, Number.POSITIVE_INFINITY),
    ),
    left: computed(() =>
      auto(left.value, inset.value.left, Number.POSITIVE_INFINITY),
    ),
  }
}

export function useAxisInterval(
  start: MaybeRefOrGetter<number>,
  end: MaybeRefOrGetter<number>,
  size: MaybeRefOrGetter<number>,
  parentStart: MaybeRefOrGetter<number>,
  parentSize: MaybeRefOrGetter<number>,
  defaultSize: MaybeRefOrGetter<number>,
  minSize: MaybeRefOrGetter<number>,
  maxSize: MaybeRefOrGetter<number>,
) {
  return computed(() => {
    const startValue = toValue(start)
    const endValue = toValue(end)
    const sizeValue = toValue(size)

    const startIsFinite = Number.isFinite(startValue)
    const sizeIsFinite = Number.isFinite(sizeValue)

    let resultStart = toValue(parentStart)
    let resultSize = sizeValue

    if (startIsFinite && sizeIsFinite) {
      resultStart += startValue
    } else {
      const endIsFinite = Number.isFinite(endValue)

      if (endIsFinite && sizeIsFinite) {
        resultStart += toValue(parentSize) - endValue - sizeValue
      } else if (startIsFinite && endIsFinite) {
        resultStart += startValue
        resultSize = toValue(parentSize) - startValue - endValue
      }
    }

    return interval(
      resultStart,
      clamp(
        auto(resultSize, toValue(defaultSize)),
        toValue(minSize),
        toValue(maxSize),
      ),
    )
  })
}

export function useXYTranslation(
  props: MaybeRefOrGetter<TranslateProps>,
  self: MaybeRefOrGetter<Rect | Dimensions>,
  overrideRoot: MaybeRefOrGetter<DimensionsLike> | undefined = undefined,
) {
  const rootWidth: MaybeRefOrGetter<number> =
    overrideRoot !== undefined
      ? () => toValue(overrideRoot).width
      : useRootWidth()
  const rootHeight: MaybeRefOrGetter<number> =
    overrideRoot !== undefined
      ? () => toValue(overrideRoot).height
      : useRootHeight()
  return computed(() => {
    const { x, y } = toValue(props)
    const { width, height } = toValue(self)

    return translate(
      resolveSize1D(x, 0, width, toValue(rootWidth), toValue(rootHeight)),
      resolveSize1D(y, 0, height, toValue(rootWidth), toValue(rootHeight)),
    )
  })
}

export function useOrigin(
  props: MaybeRefOrGetter<OriginProps>,
  defaultOrigin: MaybeRefOrGetter<Point | number> = 0,
): ComputedRef<Point> {
  return computed(() => {
    const { origin } = toValue(props)

    const defaultOriginValue = toValue(defaultOrigin)

    return resolveOrigin(
      origin,
      isPoint(defaultOriginValue)
        ? defaultOriginValue
        : point(defaultOriginValue, defaultOriginValue),
    )
  })
}

export function useOriginTranslation(
  props: OriginProps,
  defaultOrigin: MaybeRefOrGetter<Point | number> = 0,
): ComputedRef<(self: Rect) => Rect> {
  const origin = useOrigin(props, defaultOrigin)
  return computed(
    () => (self: Rect) => align(self, point(self.x, self.y), origin.value),
  )
}

export function useTransformedRect(
  rect: MaybeRefOrGetter<Rect>,
  props: TransformProps,
) {
  const originTranslation = useOriginTranslation(props)
  const translation = useXYTranslation(props, rect)

  return computed(() =>
    toValue(rect).pipe(originTranslation.value, translation.value),
  )
}

export function useRect(props: RectProps): ComputedRef<Rect> {
  const parentX = useParentX()
  const parentY = useParentY()
  const parentWidth = useParentWidth()
  const parentHeight = useParentHeight()

  const basisSize = useBasisSize(props)
  const minSize = useMinSize(props)
  const maxSize = useMaxSize(props)

  const { top, right, bottom, left } = useInset(props)

  const x = useAxisInterval(
    left,
    right,
    () => basisSize.value.width,
    parentX,
    parentWidth,
    0,
    () => minSize.value.width,
    () => maxSize.value.width,
  )

  const y = useAxisInterval(
    top,
    bottom,
    () => basisSize.value.height,
    parentY,
    parentHeight,
    0,
    () => minSize.value.height,
    () => maxSize.value.height,
  )

  return useTransformedRect(() => rect.fromInterval(x.value, y.value), props)
}
