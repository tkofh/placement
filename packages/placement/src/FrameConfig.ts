import type { Frame } from './Frame'
import { NumericProperty } from './properties/NumericProperty'
import { QuantityProperty } from './properties/QuantityProperty'
import { RatioProperty } from './properties/RatioProperty'
import { clamp } from './utils'

type RawFrameConfigValue = string | number | null

export interface FrameOptions {
  width: RawFrameConfigValue
  height: RawFrameConfigValue
  x: RawFrameConfigValue
  y: RawFrameConfigValue
  aspectRatio: RawFrameConfigValue
  minWidth: RawFrameConfigValue
  minHeight: RawFrameConfigValue
  maxWidth: RawFrameConfigValue
  maxHeight: RawFrameConfigValue
  grow: RawFrameConfigValue
  shrink: RawFrameConfigValue
  paddingTop: RawFrameConfigValue
  paddingRight: RawFrameConfigValue
  paddingBottom: RawFrameConfigValue
  paddingLeft: RawFrameConfigValue
  marginTop: RawFrameConfigValue
  marginRight: RawFrameConfigValue
  marginBottom: RawFrameConfigValue
  marginLeft: RawFrameConfigValue
}

export class FrameConfig {
  static readonly INITIAL = {
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    aspectRatio: null,
    minWidth: null,
    minHeight: null,
    maxWidth: null,
    maxHeight: null,
    grow: 0,
    shrink: 0,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    marginTop: 0,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
  } satisfies FrameOptions

  static readonly UNITS = {
    px: 0,
    percent: 1,
    vw: 2,
    vh: 3,
    vmin: 4,
    vmax: 5,
  } as const

  readonly #frame: Frame

  readonly #x: QuantityProperty
  readonly #y: QuantityProperty

  readonly #width: QuantityProperty
  readonly #height: QuantityProperty

  readonly #aspectRatio: RatioProperty

  readonly #minWidth: QuantityProperty
  readonly #minHeight: QuantityProperty
  readonly #maxWidth: QuantityProperty
  readonly #maxHeight: QuantityProperty

  readonly #paddingTop: QuantityProperty
  readonly #paddingRight: QuantityProperty
  readonly #paddingBottom: QuantityProperty
  readonly #paddingLeft: QuantityProperty
  readonly #marginTop: QuantityProperty
  readonly #marginRight: QuantityProperty
  readonly #marginBottom: QuantityProperty
  readonly #marginLeft: QuantityProperty

  readonly #grow: NumericProperty
  readonly #shrink: NumericProperty

  constructor(frame: Frame) {
    this.#frame = frame

    this.#x = new QuantityProperty(FrameConfig.INITIAL.x, false, 'width')
    this.#y = new QuantityProperty(FrameConfig.INITIAL.y, false, 'height')

    this.#width = new QuantityProperty(
      FrameConfig.INITIAL.width,
      false,
      'width',
    )
    this.#height = new QuantityProperty(
      FrameConfig.INITIAL.height,
      false,
      'height',
    )

    this.#aspectRatio = new RatioProperty(FrameConfig.INITIAL.aspectRatio)

    this.#minWidth = new QuantityProperty(
      FrameConfig.INITIAL.minWidth,
      false,
      'width',
    )
    this.#minHeight = new QuantityProperty(
      FrameConfig.INITIAL.minHeight,
      false,
      'height',
    )
    this.#maxWidth = new QuantityProperty(
      FrameConfig.INITIAL.maxWidth,
      false,
      'width',
    )
    this.#maxHeight = new QuantityProperty(
      FrameConfig.INITIAL.maxHeight,
      false,
      'height',
    )

    this.#paddingTop = new QuantityProperty(
      FrameConfig.INITIAL.paddingTop,
      false,
      'height',
    )
    this.#paddingRight = new QuantityProperty(
      FrameConfig.INITIAL.paddingRight,
      false,
      'width',
    )
    this.#paddingBottom = new QuantityProperty(
      FrameConfig.INITIAL.paddingBottom,
      false,
      'height',
    )
    this.#paddingLeft = new QuantityProperty(
      FrameConfig.INITIAL.paddingLeft,
      false,
      'width',
    )
    this.#marginTop = new QuantityProperty(
      FrameConfig.INITIAL.marginTop,
      true,
      'height',
    )
    this.#marginRight = new QuantityProperty(
      FrameConfig.INITIAL.marginRight,
      true,
      'width',
    )
    this.#marginBottom = new QuantityProperty(
      FrameConfig.INITIAL.marginBottom,
      true,
      'height',
    )
    this.#marginLeft = new QuantityProperty(
      FrameConfig.INITIAL.marginLeft,
      true,
      'width',
    )

    this.#grow = new NumericProperty(FrameConfig.INITIAL.grow)
    this.#shrink = new NumericProperty(FrameConfig.INITIAL.shrink)

    this.configure(FrameConfig.INITIAL)
  }
  //region Properties
  get width(): number {
    const width = this.#width.compute(this.#parentRect, this.#rootRect)

    if (width !== null) {
      return width
    }

    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== null && height !== null) {
      return height * this.#aspectRatio.value
    }

    return FrameConfig.INITIAL.width
  }
  get rawWidth(): RawFrameConfigValue {
    return this.#width.raw
  }
  set width(value: RawFrameConfigValue) {
    this.#width.value = value
    this.#frame.markDirty()
  }

  get height(): number {
    const height = this.#height.compute(this.#parentRect, this.#rootRect)
    if (height !== null) {
      return height
    }

    const width = this.#width.compute(this.#parentRect, this.#rootRect)
    if (this.#aspectRatio.value !== null && width !== null) {
      return width / this.#aspectRatio.value
    }

    return FrameConfig.INITIAL.height
  }
  get rawHeight(): RawFrameConfigValue {
    return this.#height.raw
  }
  set height(value: RawFrameConfigValue) {
    this.#height.value = value
    this.#frame.markDirty()
  }

  get x(): number {
    return (
      this.#x.compute(this.#parentRect, this.#rootRect) ?? FrameConfig.INITIAL.x
    )
  }
  get rawX(): RawFrameConfigValue {
    return this.#x.raw
  }
  set x(value: RawFrameConfigValue) {
    this.#x.value = value
    this.#frame.markDirty()
  }

  get y(): number {
    return (
      this.#y.compute(this.#parentRect, this.#rootRect) ?? FrameConfig.INITIAL.y
    )
  }
  get rawY(): RawFrameConfigValue {
    return this.#y.raw
  }
  set y(value: RawFrameConfigValue) {
    this.#y.value = value
    this.#frame.markDirty()
  }

  get aspectRatio(): number | null {
    if (this.#aspectRatio.value !== null) {
      return this.#aspectRatio.value
    }

    const width = this.#width.compute(this.#parentRect, this.#rootRect)
    const height = this.#height.compute(this.#parentRect, this.#rootRect)

    if (width !== null && height !== null && width > 0 && height > 0) {
      return width / height
    }

    return FrameConfig.INITIAL.aspectRatio
  }
  get rawAspectRatio(): RawFrameConfigValue {
    return this.#aspectRatio.raw
  }
  set aspectRatio(value: RawFrameConfigValue) {
    this.#aspectRatio.value = value
    this.#frame.markDirty()
  }

  get minWidth(): number | null {
    return (
      this.#minWidth.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.minWidth
    )
  }
  get rawMinWidth(): RawFrameConfigValue {
    return this.#minWidth.raw
  }
  set minWidth(value: RawFrameConfigValue) {
    this.#minWidth.value = value
    this.#frame.markDirty()
  }

  get minHeight(): number | null {
    return (
      this.#minHeight.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.minHeight
    )
  }
  get rawMinHeight(): RawFrameConfigValue {
    return this.#minHeight.raw
  }
  set minHeight(value: RawFrameConfigValue) {
    this.#minHeight.value = value
    this.#frame.markDirty()
  }

  get maxWidth(): number | null {
    return (
      this.#maxWidth.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.maxWidth
    )
  }
  get rawMaxWidth(): RawFrameConfigValue {
    return this.#maxWidth.raw
  }
  set maxWidth(value: RawFrameConfigValue) {
    this.#maxWidth.value = value
    this.#frame.markDirty()
  }

  get maxHeight(): number | null {
    return (
      this.#maxHeight.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.maxHeight
    )
  }
  get rawMaxHeight(): RawFrameConfigValue {
    return this.#maxHeight.raw
  }
  set maxHeight(value: RawFrameConfigValue) {
    this.#maxHeight.value = value
    this.#frame.markDirty()
  }

  get grow(): number {
    return this.#grow.value
  }
  get rawGrow(): RawFrameConfigValue {
    return this.#grow.raw
  }
  set grow(value: RawFrameConfigValue) {
    this.#grow.value = value
    this.#frame.markDirty()
  }

  get shrink(): number {
    return this.#shrink.value
  }
  get rawShrink(): RawFrameConfigValue {
    return this.#shrink.raw
  }
  set shrink(value: RawFrameConfigValue) {
    this.#shrink.value = value
    this.#frame.markDirty()
  }

  get paddingTop(): number {
    return (
      this.#paddingTop.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.paddingTop
    )
  }
  get rawPaddingTop(): RawFrameConfigValue {
    return this.#paddingTop.raw
  }
  set paddingTop(value: RawFrameConfigValue) {
    this.#paddingTop.value = value
    this.#frame.markDirty()
  }

  get paddingRight(): number {
    return (
      this.#paddingRight.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.paddingRight
    )
  }
  get rawPaddingRight(): RawFrameConfigValue {
    return this.#paddingRight.raw
  }
  set paddingRight(value: RawFrameConfigValue) {
    this.#paddingRight.value = value
    this.#frame.markDirty()
  }

  get paddingBottom(): number {
    return (
      this.#paddingBottom.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.paddingBottom
    )
  }
  get rawPaddingBottom(): RawFrameConfigValue {
    return this.#paddingBottom.raw
  }
  set paddingBottom(value: RawFrameConfigValue) {
    this.#paddingBottom.value = value
    this.#frame.markDirty()
  }

  get paddingLeft(): number {
    return (
      this.#paddingLeft.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.paddingLeft
    )
  }
  get rawPaddingLeft(): RawFrameConfigValue {
    return this.#paddingLeft.raw
  }
  set paddingLeft(value: RawFrameConfigValue) {
    this.#paddingLeft.value = value
    this.#frame.markDirty()
  }

  get marginTop(): number {
    return (
      this.#marginTop.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.marginTop
    )
  }
  get rawMarginTop(): RawFrameConfigValue {
    return this.#marginTop.raw
  }
  set marginTop(value: RawFrameConfigValue) {
    this.#marginTop.value = value
    this.#frame.markDirty()
  }

  get marginRight(): number {
    return (
      this.#marginRight.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.marginRight
    )
  }
  get rawMarginRight(): RawFrameConfigValue {
    return this.#marginRight.raw
  }
  set marginRight(value: RawFrameConfigValue) {
    this.#marginRight.value = value
    this.#frame.markDirty()
  }

  get marginBottom(): number {
    return (
      this.#marginBottom.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.marginBottom
    )
  }
  get rawMarginBottom(): RawFrameConfigValue {
    return this.#marginBottom.raw
  }
  set marginBottom(value: RawFrameConfigValue) {
    this.#marginBottom.value = value
    this.#frame.markDirty()
  }

  get marginLeft(): number {
    return (
      this.#marginLeft.compute(this.#parentRect, this.#rootRect) ??
      FrameConfig.INITIAL.marginLeft
    )
  }
  get rawMarginLeft(): RawFrameConfigValue {
    return this.#marginLeft.raw
  }
  set marginLeft(value: RawFrameConfigValue) {
    this.#marginLeft.value = value
    this.#frame.markDirty()
  }
  //endregion

  //region Computed Properties
  get effectiveMinWidth(): number {
    return Math.max(this.minWidth ?? 0, this.paddingLeft + this.paddingRight)
  }
  get innerEffectiveMinWidth(): number {
    return this.effectiveMinWidth - this.paddingLeft - this.paddingRight
  }
  get outerEffectiveMinWidth(): number {
    return this.effectiveMinWidth + this.marginLeft + this.marginRight
  }

  get effectiveMaxWidth(): number {
    return Math.max(
      this.maxWidth ?? Number.POSITIVE_INFINITY,
      this.effectiveMinWidth,
    )
  }
  get innerEffectiveMaxWidth(): number {
    return this.effectiveMaxWidth - this.paddingLeft - this.paddingRight
  }
  get outerEffectiveMaxWidth(): number {
    return this.effectiveMaxWidth + this.marginLeft + this.marginRight
  }

  get effectiveMinHeight(): number {
    return Math.max(this.minHeight ?? 0, this.paddingTop + this.paddingBottom)
  }
  get innerEffectiveMinHeight(): number {
    return this.effectiveMinHeight - this.paddingTop - this.paddingBottom
  }
  get outerEffectiveMinHeight(): number {
    return this.effectiveMinHeight + this.marginTop + this.marginBottom
  }

  get effectiveMaxHeight(): number {
    return Math.max(
      this.maxHeight ?? Number.POSITIVE_INFINITY,
      this.effectiveMinHeight,
    )
  }
  get innerEffectiveMaxHeight(): number {
    return this.effectiveMaxHeight - this.paddingTop - this.paddingBottom
  }
  get outerEffectiveMaxHeight(): number {
    return this.effectiveMaxHeight + this.marginTop + this.marginBottom
  }

  get constrainedWidth(): number {
    return clamp(this.width, this.effectiveMinWidth, this.effectiveMaxWidth)
  }
  get innerConstrainedWidth(): number {
    return this.constrainedWidth - this.paddingLeft - this.paddingRight
  }
  get outerConstrainedWidth(): number {
    return this.constrainedWidth + this.marginLeft + this.marginRight
  }

  get constrainedHeight(): number {
    return clamp(this.height, this.effectiveMinHeight, this.effectiveMaxHeight)
  }
  get innerConstrainedHeight(): number {
    return this.constrainedHeight - this.paddingTop - this.paddingBottom
  }
  get outerConstrainedHeight(): number {
    return this.constrainedHeight + this.marginTop + this.marginBottom
  }
  //endregion

  get #parentRect() {
    return this.#frame.parent?.innerRect ?? this.#frame.rect
  }

  get #rootRect() {
    if (this.#frame.root === this.#frame) {
      return this.#frame.rect
    }
    return this.#frame.root.innerRect
  }

  configure(options: Partial<FrameOptions>) {
    if (options.width != null) {
      this.#width.value = options.width
    }
    if (options.height != null) {
      this.#height.value = options.height
    }
    if (options.x != null) {
      this.#x.value = options.x
    }
    if (options.y != null) {
      this.#y.value = options.y
    }
    if (options.aspectRatio != null) {
      this.#aspectRatio.value = options.aspectRatio
    }
    if (options.minWidth != null) {
      this.#minWidth.value = options.minWidth
    }
    if (options.minHeight != null) {
      this.#minHeight.value = options.minHeight
    }
    if (options.maxWidth != null) {
      this.#maxWidth.value = options.maxWidth
    }
    if (options.maxHeight != null) {
      this.#maxHeight.value = options.maxHeight
    }
    if (options.grow != null) {
      this.#shrink.value = options.grow
    }
    if (options.shrink != null) {
      this.#grow.value = options.shrink
    }
    if (options.paddingTop != null) {
      this.#paddingTop.value = options.paddingTop
    }
    if (options.paddingRight != null) {
      this.#paddingRight.value = options.paddingRight
    }
    if (options.paddingBottom != null) {
      this.#paddingBottom.value = options.paddingBottom
    }
    if (options.paddingLeft != null) {
      this.#paddingLeft.value = options.paddingLeft
    }
    if (options.marginTop != null) {
      this.#marginTop.value = options.marginTop
    }
    if (options.marginRight != null) {
      this.#marginRight.value = options.marginRight
    }
    if (options.marginBottom != null) {
      this.#marginBottom.value = options.marginBottom
    }
    if (options.marginLeft != null) {
      this.#marginLeft.value = options.marginLeft
    }

    this.#frame.markDirty()
  }
}
