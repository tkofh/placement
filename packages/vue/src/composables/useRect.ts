import {
  type Dimensions,
  clamp as clampDimensions,
  dimensions,
  isDimensions,
} from 'placement/dimensions'
import { interval } from 'placement/interval'
import { type Offset, offset } from 'placement/offset'
import { type Point, isPoint, point } from 'placement/point'
import { type Rect, align, isRect, rect, translate } from 'placement/rect'
import { auto, clamp } from 'placement/utils'
import { type ComputedRef, type MaybeRefOrGetter, computed, toValue } from 'vue'
import {
  type AspectRatioInput,
  parseAspectRatio,
} from '../internal/props/aspectRatio'
import { type InsetInput, parseInset } from '../internal/props/inset'
import { type OriginInput, parseOrigin } from '../internal/props/origin'
import { type Size1DInput, parseSize1D } from '../internal/props/size1d'
import { type Size2DInput, parseSize2D } from '../internal/props/size2d'

export interface SizeProps {
  size?: Size2DInput | Dimensions | number | undefined
  minSize?: Size2DInput | Dimensions | number | undefined
  maxSize?: Size2DInput | Dimensions | number | undefined
  width?: Size1DInput | number | undefined
  height?: Size1DInput | number | undefined
  aspectRatio?: AspectRatioInput | number | undefined
  minWidth?: Size1DInput | number | undefined
  minHeight?: Size1DInput | number | undefined
  maxWidth?: Size1DInput | number | undefined
  maxHeight?: Size1DInput | number | undefined
}

export const SIZE_PROP_KEYS = [
  'size',
  'minSize',
  'maxSize',
  'width',
  'height',
  'aspectRatio',
  'minWidth',
  'minHeight',
  'maxWidth',
  'maxHeight',
] as const

export interface PositionProps {
  top?: Size1DInput | number
  right?: Size1DInput | number
  bottom?: Size1DInput | number
  left?: Size1DInput | number
  inset?: InsetInput | Point | number
}

export const POSITION_PROP_KEYS = [
  'top',
  'right',
  'bottom',
  'left',
  'inset',
] as const

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

export interface RectProps extends PositionProps, SizeProps, TransformProps {}

export const RECT_PROP_KEYS = [
  ...SIZE_PROP_KEYS,
  ...POSITION_PROP_KEYS,
  ...TRANSFORM_PROP_KEYS,
] as const

function resolveSize1D(
  input: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
) {
  return typeof input === 'number'
    ? input
    : parseSize1D(input ?? '', basis, auto, parent, root)
}

function resolveSize2D(
  input: Size2DInput | Dimensions | number | undefined,
  auto: number,
  parent: Dimensions | Rect,
  root: Dimensions | Rect,
) {
  return isDimensions(input)
    ? input
    : typeof input === 'number'
      ? dimensions(input)
      : parseSize2D(input ?? '', auto, parent, root)
}

function calculateSize(
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
  auto: number,
  size: Size2DInput | Dimensions | number | undefined,
  width: Size1DInput | number | undefined,
  height: Size1DInput | number | undefined,
  aspectRatio: AspectRatioInput | number | undefined,
) {
  const sizeProp = resolveSize2D(size, Number.POSITIVE_INFINITY, parent, root)

  if (Number.isFinite(sizeProp.width) && Number.isFinite(sizeProp.height)) {
    return sizeProp
  }

  const widthProp = resolveSize1D(
    width,
    'width',
    Number.POSITIVE_INFINITY,
    parent,
    root,
  )

  const heightProp = resolveSize1D(
    height,
    'height',
    Number.POSITIVE_INFINITY,
    parent,
    root,
  )

  if (Number.isFinite(widthProp) && Number.isFinite(heightProp)) {
    return dimensions(widthProp, heightProp)
  }

  const aspectRatioProp =
    typeof aspectRatio === 'number'
      ? aspectRatio
      : parseAspectRatio((aspectRatio as string) ?? '')

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

function resolveInset(
  inset: InsetInput | Point | number | undefined,
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
): Offset {
  if (inset === undefined) {
    return offset.infinity
  }

  if (typeof inset === 'number') {
    return offset(inset)
  }

  if (isPoint(inset)) {
    return offset.xy(inset.x, inset.y)
  }

  return parseInset(inset, parent, root)
}

function resolveEdgeInset(
  edge: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  parent: Rect | Dimensions,
  root: Rect | Dimensions,
): number {
  if (edge === undefined) {
    return Number.POSITIVE_INFINITY
  }

  if (typeof edge === 'number') {
    return edge
  }

  return parseSize1D(edge, basis, Number.POSITIVE_INFINITY, parent, root)
}

function resolveTranslation(
  axis: Size1DInput | number | undefined,
  basis: 'width' | 'height',
  self: Rect,
  root: Rect | Dimensions,
): number {
  if (axis === undefined) {
    return 0
  }

  if (typeof axis === 'number') {
    return axis
  }

  return parseSize1D(axis, basis, 0, self, root)
}

export function useUnconstrainedSizes(
  input: MaybeRefOrGetter<SizeProps>,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const size = computed(() => {
    const { size, width, height, aspectRatio } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      Number.POSITIVE_INFINITY,
      size,
      width,
      height,
      aspectRatio,
    )
  })

  const minSize = computed(() => {
    const { minSize, minWidth, minHeight } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      0,
      minSize,
      minWidth,
      minHeight,
      Number.POSITIVE_INFINITY,
    )
  })

  const maxSize = computed(() => {
    const { maxSize, maxWidth, maxHeight } = toValue(input)

    return calculateSize(
      toValue(parent),
      toValue(root),
      Number.POSITIVE_INFINITY,
      maxSize,
      maxWidth,
      maxHeight,
      Number.POSITIVE_INFINITY,
    )
  })

  return { size, minSize, maxSize }
}

export function useSize(
  input: MaybeRefOrGetter<SizeProps>,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const { size, minSize, maxSize } = useUnconstrainedSizes(input, parent, root)

  return computed(() =>
    clampDimensions(size.value, minSize.value, maxSize.value),
  )
}

export function useInset(
  props: PositionProps,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
): ComputedRef<Offset> {
  const top = computed(() =>
    resolveEdgeInset(props.top, 'height', toValue(parent), toValue(root)),
  )
  const right = computed(() =>
    resolveEdgeInset(props.right, 'width', toValue(parent), toValue(root)),
  )
  const bottom = computed(() =>
    resolveEdgeInset(props.bottom, 'height', toValue(parent), toValue(root)),
  )
  const left = computed(() =>
    resolveEdgeInset(props.left, 'width', toValue(parent), toValue(root)),
  )
  const inset = computed(() =>
    resolveInset(props.inset, toValue(parent), toValue(root)),
  )

  return computed(() =>
    offset.trbl(
      auto(top.value, inset.value.top, Number.POSITIVE_INFINITY),
      auto(right.value, inset.value.right, Number.POSITIVE_INFINITY),
      auto(bottom.value, inset.value.bottom, Number.POSITIVE_INFINITY),
      auto(left.value, inset.value.left, Number.POSITIVE_INFINITY),
    ),
  )
}

export function useXYTranslation(
  props: TranslateProps,
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  return computed(() => {
    const rectValue = toValue(rect)
    const rootValue = toValue(root)
    const x = resolveTranslation(props.x, 'width', rectValue, rootValue)
    const y = resolveTranslation(props.y, 'height', rectValue, rootValue)

    return translate(x, y)
  })
}

export function useOrigin(
  props: OriginProps,
  defaultOrigin: MaybeRefOrGetter<Point | number> = 0,
): ComputedRef<Point> {
  return computed(() => {
    const input = props.origin

    let origin: Point

    if (input == null) {
      const defaultOriginValue = toValue(defaultOrigin)
      origin = isPoint(defaultOriginValue)
        ? defaultOriginValue
        : point(defaultOriginValue)
    } else if (isPoint(input)) {
      origin = input
    } else if (typeof input === 'number') {
      origin = point(input)
    } else {
      origin = parseOrigin(input)
    }

    return origin
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
  root: MaybeRefOrGetter<Rect | Dimensions>,
) {
  const originTranslation = useOriginTranslation(props)
  const translation = useXYTranslation(props, root)

  return computed(() =>
    toValue(rect).pipe(originTranslation.value, translation.value),
  )
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

export function useRect(
  props: RectProps,
  parent: MaybeRefOrGetter<Rect | Dimensions>,
  root: MaybeRefOrGetter<Rect | Dimensions>,
): ComputedRef<Rect> {
  const { size, minSize, maxSize } = useUnconstrainedSizes(props, parent, root)

  const position = useInset(props, parent, root)

  const x = useAxisInterval(
    () => position.value.left,
    () => position.value.right,
    () => size.value.width,
    () => {
      const value = toValue(parent)
      return isRect(value) ? value.x : 0
    },
    () => toValue(parent).width,
    0,
    () => minSize.value.width,
    () => maxSize.value.width,
  )

  const y = useAxisInterval(
    () => position.value.top,
    () => position.value.bottom,
    () => size.value.height,
    () => {
      const value = toValue(parent)
      return isRect(value) ? value.y : 0
    },
    () => toValue(parent).height,
    0,
    () => minSize.value.height,
    () => maxSize.value.height,
  )

  return useTransformedRect(
    () => rect.fromInterval(x.value, y.value),
    props,
    root,
  )
}
