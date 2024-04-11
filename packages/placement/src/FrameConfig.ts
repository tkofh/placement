import type { Frame } from './Frame'
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

  #rawWidth!: RawFrameConfigValue
  #rawHeight!: RawFrameConfigValue
  #rawX!: RawFrameConfigValue
  #rawY!: RawFrameConfigValue
  #rawAspectRatio!: RawFrameConfigValue
  #rawMinWidth!: RawFrameConfigValue
  #rawMinHeight!: RawFrameConfigValue
  #rawMaxWidth!: RawFrameConfigValue
  #rawMaxHeight!: RawFrameConfigValue
  #rawShrink!: RawFrameConfigValue
  #rawGrow!: RawFrameConfigValue
  #rawPaddingTop!: RawFrameConfigValue
  #rawPaddingRight!: RawFrameConfigValue
  #rawPaddingBottom!: RawFrameConfigValue
  #rawPaddingLeft!: RawFrameConfigValue
  #rawMarginTop!: RawFrameConfigValue
  #rawMarginRight!: RawFrameConfigValue
  #rawMarginBottom!: RawFrameConfigValue
  #rawMarginLeft!: RawFrameConfigValue

  #width!: number
  #height!: number
  #x!: number
  #y!: number
  #aspectRatio!: number
  #minWidth!: number
  #minHeight!: number
  #maxWidth!: number
  #maxHeight!: number
  #shrink!: number
  #grow!: number
  #paddingTop!: number
  #paddingRight!: number
  #paddingBottom!: number
  #paddingLeft!: number
  #marginTop!: number
  #marginRight!: number
  #marginBottom!: number
  #marginLeft!: number

  #widthUnit!: number
  #heightUnit!: number
  #xUnit!: number
  #yUnit!: number
  #minWidthUnit!: number
  #minHeightUnit!: number
  #maxWidthUnit!: number
  #maxHeightUnit!: number
  #paddingTopUnit!: number
  #paddingRightUnit!: number
  #paddingBottomUnit!: number
  #paddingLeftUnit!: number
  #marginTopUnit!: number
  #marginRightUnit!: number
  #marginBottomUnit!: number
  #marginLeftUnit!: number

  constructor(frame: Frame) {
    this.#frame = frame
    this.configure(FrameConfig.INITIAL)
  }
  //region Properties
  get width(): number {
    if (this.#width > 0) {
      return this.#computeQuantity(
        this.#width,
        this.#widthUnit,
        this.#parentRect.width,
      )
    }

    if (this.#aspectRatio > 0 && this.#height > 0) {
      const height = this.#computeQuantity(
        this.#height,
        this.#heightUnit,
        this.#parentRect.height,
      )
      return height * this.#aspectRatio
    }

    return FrameConfig.INITIAL.width
  }
  get rawWidth(): RawFrameConfigValue {
    return this.#rawWidth
  }
  set width(value: RawFrameConfigValue) {
    this.#internalWidth = value
    this.#frame.markDirty()
  }
  set #internalWidth(value: RawFrameConfigValue) {
    if (value === null) {
      this.#width = -1
    } else {
      ;[this.#width, this.#widthUnit] = this.#parseQuantity(value, false)
    }
    this.#rawWidth = value
  }

  get height(): number {
    if (this.#height > 0) {
      return this.#computeQuantity(
        this.#height,
        this.#heightUnit,
        this.#parentRect.height,
      )
    }

    if (this.#aspectRatio > 0 && this.#width > 0) {
      const width = this.#computeQuantity(
        this.#width,
        this.#widthUnit,
        this.#parentRect.width,
      )
      return width / this.#aspectRatio
    }

    return FrameConfig.INITIAL.height
  }
  get rawHeight(): RawFrameConfigValue {
    return this.#rawHeight
  }
  set height(value: RawFrameConfigValue) {
    this.#internalHeight = value
    this.#frame.markDirty()
  }
  set #internalHeight(value: RawFrameConfigValue) {
    if (value === null) {
      this.#height = -1
    } else {
      ;[this.#height, this.#heightUnit] = this.#parseQuantity(value, false)
    }
    this.#rawHeight = value
  }

  get x(): number {
    return this.#computeQuantity(this.#x, this.#xUnit, this.#parentRect.width)
  }
  get rawX(): RawFrameConfigValue {
    return this.#rawX
  }
  set x(value: RawFrameConfigValue | undefined) {
    this.#internalX = value
    this.#frame.markDirty()
  }
  set #internalX(value: RawFrameConfigValue | undefined) {
    const input = value ?? FrameConfig.INITIAL.x
    ;[this.#x, this.#xUnit] = this.#parseQuantity(input, true)
    this.#rawX = input
  }

  get y(): number {
    return this.#computeQuantity(this.#y, this.#yUnit, this.#parentRect.height)
  }
  get rawY(): RawFrameConfigValue {
    return this.#rawY
  }
  set y(value: RawFrameConfigValue | undefined) {
    this.#internalY = value
    this.#frame.markDirty()
  }
  set #internalY(value: RawFrameConfigValue | undefined) {
    const input = value ?? FrameConfig.INITIAL.y
    ;[this.#y, this.#yUnit] = this.#parseQuantity(input, true)
    this.#rawY = input
  }

  get aspectRatio(): number | null {
    if (this.#aspectRatio > 0) {
      return this.#aspectRatio
    }

    if (this.#height > 0 && this.#width > 0) {
      const width = this.#computeQuantity(
        this.#width,
        this.#widthUnit,
        this.#parentRect.width,
      )
      const height = this.#computeQuantity(
        this.#height,
        this.#heightUnit,
        this.#parentRect.height,
      )
      return width / height
    }

    return FrameConfig.INITIAL.aspectRatio
  }
  get rawAspectRatio(): RawFrameConfigValue {
    return this.#rawAspectRatio
  }
  set aspectRatio(value: RawFrameConfigValue) {
    this.#internalAspectRatio = value
    this.#frame.markDirty()
  }
  set #internalAspectRatio(value: RawFrameConfigValue) {
    if (value === null) {
      this.#aspectRatio = -1
    } else {
      this.#aspectRatio = this.#parseRatio(value)
    }
    this.#rawAspectRatio = value
  }

  get minWidth(): number | null {
    if (this.#minWidth > 0) {
      return this.#computeQuantity(
        this.#minWidth,
        this.#minWidthUnit,
        this.#parentRect.width,
      )
    }

    return FrameConfig.INITIAL.minWidth
  }
  get rawMinWidth(): RawFrameConfigValue {
    return this.#rawMinWidth
  }
  set minWidth(value: RawFrameConfigValue) {
    this.#internalMinWidth = value
    this.#frame.markDirty()
  }
  set #internalMinWidth(value: RawFrameConfigValue) {
    if (value == null) {
      this.#minWidth = -1
    } else {
      ;[this.#minWidth, this.#minWidthUnit] = this.#parseQuantity(value, false)
    }
    this.#rawMinWidth = value
  }

  get minHeight(): number | null {
    if (this.#minHeight > 0) {
      return this.#computeQuantity(
        this.#minHeight,
        this.#minHeightUnit,
        this.#parentRect.height,
      )
    }

    return FrameConfig.INITIAL.minHeight
  }
  get rawMinHeight(): RawFrameConfigValue {
    return this.#rawMinHeight
  }
  set minHeight(value: RawFrameConfigValue) {
    this.#internalMinHeight = value
    this.#frame.markDirty()
  }
  set #internalMinHeight(value: RawFrameConfigValue) {
    if (value == null) {
      this.#minHeight = -1
    } else {
      ;[this.#minHeight, this.#minHeightUnit] = this.#parseQuantity(
        value,
        false,
      )
    }
    this.#rawMinHeight = value
  }

  get maxWidth(): number | null {
    if (this.#maxWidth > 0) {
      return this.#computeQuantity(
        this.#maxWidth,
        this.#maxWidthUnit,
        this.#parentRect.width,
      )
    }

    return FrameConfig.INITIAL.maxWidth
  }
  get rawMaxWidth(): RawFrameConfigValue {
    return this.#rawMaxWidth
  }
  set maxWidth(value: RawFrameConfigValue) {
    this.#internalMaxWidth = value
    this.#frame.markDirty()
  }
  set #internalMaxWidth(value: RawFrameConfigValue) {
    if (value == null) {
      this.#maxWidth = -1
    } else {
      ;[this.#maxWidth, this.#maxWidthUnit] = this.#parseQuantity(value, false)
    }
    this.#rawMaxWidth = value
  }

  get maxHeight(): number | null {
    if (this.#maxHeight > 0) {
      return this.#computeQuantity(
        this.#maxHeight,
        this.#maxHeightUnit,
        this.#parentRect.height,
      )
    }

    return FrameConfig.INITIAL.maxHeight
  }
  get rawMaxHeight(): RawFrameConfigValue {
    return this.#rawMaxHeight
  }
  set maxHeight(value: RawFrameConfigValue) {
    this.#internalMaxHeight = value
    this.#frame.markDirty()
  }
  set #internalMaxHeight(value: RawFrameConfigValue) {
    if (value == null) {
      this.#maxHeight = -1
    } else {
      ;[this.#maxHeight, this.#maxHeightUnit] = this.#parseQuantity(
        value,
        false,
      )
    }
    this.#rawMaxHeight = value
  }

  get grow(): number {
    return this.#grow
  }
  get rawGrow(): RawFrameConfigValue {
    return this.#rawGrow
  }
  set grow(value: RawFrameConfigValue) {
    this.#internalGrow = value
    this.#frame.markDirty()
  }
  set #internalGrow(value: RawFrameConfigValue) {
    this.#grow = this.#parseNumber(value ?? FrameConfig.INITIAL.grow)
    this.#rawGrow = value
  }

  get shrink(): number {
    return this.#shrink
  }
  get rawShrink(): RawFrameConfigValue {
    return this.#rawShrink
  }
  set shrink(value: RawFrameConfigValue) {
    this.#internalShrink = value
    this.#frame.markDirty()
  }
  set #internalShrink(value: RawFrameConfigValue) {
    this.#shrink = this.#parseNumber(value ?? FrameConfig.INITIAL.shrink)
    this.#rawShrink = value
  }

  get paddingTop(): number {
    return this.#computeQuantity(
      this.#paddingTop,
      this.#paddingTopUnit,
      this.#parentRect.height,
    )
  }
  get rawPaddingTop(): RawFrameConfigValue {
    return this.#rawPaddingTop
  }
  set paddingTop(value: RawFrameConfigValue) {
    this.#internalPaddingTop = value
    this.#frame.markDirty()
  }
  set #internalPaddingTop(value: RawFrameConfigValue) {
    ;[this.#paddingTop, this.#paddingTopUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.paddingTop,
      false,
    )
  }

  get paddingRight(): number {
    return this.#computeQuantity(
      this.#paddingRight,
      this.#paddingRightUnit,
      this.#parentRect.width,
    )
  }
  get rawPaddingRight(): RawFrameConfigValue {
    return this.#rawPaddingRight
  }
  set paddingRight(value: RawFrameConfigValue) {
    this.#internalPaddingRight = value
    this.#frame.markDirty()
  }
  set #internalPaddingRight(value: RawFrameConfigValue) {
    ;[this.#paddingRight, this.#paddingRightUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.paddingRight,
      false,
    )
  }

  get paddingBottom(): number {
    return this.#computeQuantity(
      this.#paddingBottom,
      this.#paddingBottomUnit,
      this.#parentRect.height,
    )
  }
  get rawPaddingBottom(): RawFrameConfigValue {
    return this.#rawPaddingBottom
  }
  set paddingBottom(value: RawFrameConfigValue) {
    this.#internalPaddingBottom = value
    this.#frame.markDirty()
  }
  set #internalPaddingBottom(value: RawFrameConfigValue) {
    ;[this.#paddingBottom, this.#paddingBottomUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.paddingBottom,
      false,
    )
  }

  get paddingLeft(): number {
    return this.#computeQuantity(
      this.#paddingLeft,
      this.#paddingLeftUnit,
      this.#parentRect.width,
    )
  }
  get rawPaddingLeft(): RawFrameConfigValue {
    return this.#rawPaddingLeft
  }
  set paddingLeft(value: RawFrameConfigValue) {
    this.#internalPaddingLeft = value
    this.#frame.markDirty()
  }
  set #internalPaddingLeft(value: RawFrameConfigValue) {
    ;[this.#paddingLeft, this.#paddingLeftUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.paddingLeft,
      false,
    )
  }

  get marginTop(): number {
    return this.#computeQuantity(
      this.#marginTop,
      this.#marginTopUnit,
      this.#parentRect.height,
    )
  }
  get rawMarginTop(): RawFrameConfigValue {
    return this.#rawMarginTop
  }
  set marginTop(value: RawFrameConfigValue) {
    this.#internalMarginTop = value
    this.#frame.markDirty()
  }
  set #internalMarginTop(value: RawFrameConfigValue) {
    ;[this.#marginTop, this.#marginTopUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.marginTop,
      true,
    )
  }

  get marginRight(): number {
    return this.#computeQuantity(
      this.#marginRight,
      this.#marginRightUnit,
      this.#parentRect.width,
    )
  }
  get rawMarginRight(): RawFrameConfigValue {
    return this.#rawMarginRight
  }
  set marginRight(value: RawFrameConfigValue) {
    this.#internalMarginRight = value
    this.#frame.markDirty()
  }
  set #internalMarginRight(value: RawFrameConfigValue) {
    ;[this.#marginRight, this.#marginRightUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.marginRight,
      true,
    )
  }

  get marginBottom(): number {
    return this.#computeQuantity(
      this.#marginBottom,
      this.#marginBottomUnit,
      this.#parentRect.height,
    )
  }
  get rawMarginBottom(): RawFrameConfigValue {
    return this.#rawMarginBottom
  }
  set marginBottom(value: RawFrameConfigValue) {
    this.#internalMarginBottom = value
    this.#frame.markDirty()
  }
  set #internalMarginBottom(value: RawFrameConfigValue) {
    ;[this.#marginBottom, this.#marginBottomUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.marginBottom,
      true,
    )
  }

  get marginLeft(): number {
    return this.#computeQuantity(
      this.#marginLeft,
      this.#marginLeftUnit,
      this.#parentRect.width,
    )
  }
  get rawMarginLeft(): RawFrameConfigValue {
    return this.#rawMarginLeft
  }
  set marginLeft(value: RawFrameConfigValue) {
    this.#internalMarginLeft = value
    this.#frame.markDirty()
  }
  set #internalMarginLeft(value: RawFrameConfigValue) {
    ;[this.#marginLeft, this.#marginLeftUnit] = this.#parseQuantity(
      value ?? FrameConfig.INITIAL.marginLeft,
      true,
    )
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
      this.#internalWidth = options.width
    }
    if (options.height != null) {
      this.#internalHeight = options.height
    }
    if (options.x != null) {
      this.#internalX = options.x
    }
    if (options.y != null) {
      this.#internalY = options.y
    }
    if (options.aspectRatio != null) {
      this.#internalAspectRatio = options.aspectRatio
    }
    if (options.minWidth != null) {
      this.#internalMinWidth = options.minWidth
    }
    if (options.minHeight != null) {
      this.#internalMinHeight = options.minHeight
    }
    if (options.maxWidth != null) {
      this.#internalMaxWidth = options.maxWidth
    }
    if (options.maxHeight != null) {
      this.#internalMaxHeight = options.maxHeight
    }
    if (options.grow != null) {
      this.#internalGrow = options.grow
    }
    if (options.shrink != null) {
      this.#internalShrink = options.shrink
    }
    if (options.paddingTop != null) {
      this.#internalPaddingTop = options.paddingTop
    }
    if (options.paddingRight != null) {
      this.#internalPaddingRight = options.paddingRight
    }
    if (options.paddingBottom != null) {
      this.#internalPaddingBottom = options.paddingBottom
    }
    if (options.paddingLeft != null) {
      this.#internalPaddingLeft = options.paddingLeft
    }
    if (options.marginTop != null) {
      this.#internalMarginTop = options.marginTop
    }
    if (options.marginRight != null) {
      this.#internalMarginRight = options.marginRight
    }
    if (options.marginBottom != null) {
      this.#internalMarginBottom = options.marginBottom
    }
    if (options.marginLeft != null) {
      this.#internalMarginLeft = options.marginLeft
    }

    this.#frame.markDirty()
  }

  #parseNumber(value: string | number) {
    if (typeof value === 'number') {
      return value
    }

    const parsed = Number.parseFloat(value)

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid number: ${value}`)
    }

    return parsed
  }

  #parseRatio(value: string | number) {
    if (typeof value === 'number') {
      if (value === 0) {
        throw new Error('Ratio cannot be 0')
      }

      return value
    }

    const [numerator, denominator] = value.split('/')

    const parsedNumerator = Number(numerator)

    if (Number.isNaN(parsedNumerator)) {
      throw new Error(
        `Invalid ratio: ${value} (numerator must be a number, got ${denominator})`,
      )
    }

    if (denominator === undefined) {
      return parsedNumerator
    }

    const parsedDenominator = Number(denominator)

    if (Number.isNaN(parsedDenominator) || parsedDenominator === 0) {
      throw new Error(
        `Invalid ratio: ${value} (denominator must be a non-zero number, got ${denominator})`,
      )
    }

    return parsedNumerator / parsedDenominator
  }

  #parseQuantity(value: string | number, allowNegative: boolean) {
    if (typeof value === 'number') {
      return [value, FrameConfig.UNITS.px]
    }

    let unit: number = FrameConfig.UNITS.px
    let parsed: number

    if (value.endsWith('px')) {
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('%')) {
      unit = FrameConfig.UNITS.percent
      parsed = Number.parseFloat(value.slice(0, -1))
    } else if (value.endsWith('vw')) {
      unit = FrameConfig.UNITS.vw
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vh')) {
      unit = FrameConfig.UNITS.vh
      parsed = Number.parseFloat(value.slice(0, -2))
    } else if (value.endsWith('vmin')) {
      unit = FrameConfig.UNITS.vmin
      parsed = Number.parseFloat(value.slice(0, -4))
    } else if (value.endsWith('vmax')) {
      unit = FrameConfig.UNITS.vmax
      parsed = Number.parseFloat(value.slice(0, -4))
    } else {
      throw new Error(`Could not parse quantity ${value}`)
    }

    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid quantity: ${value}`)
    }

    if (!allowNegative && parsed < 0) {
      throw new Error(
        `Negative values are not allowed for this property: ${value}`,
      )
    }

    return [parsed, unit]
  }

  #computeQuantity(value: number, unit: number, percentBasis: number) {
    switch (unit) {
      case FrameConfig.UNITS.px:
        return value
      case FrameConfig.UNITS.percent:
        return (percentBasis * value) / 100
      case FrameConfig.UNITS.vw:
        return (this.#rootRect.width * value) / 100
      case FrameConfig.UNITS.vh:
        return (this.#rootRect.height * value) / 100
      case FrameConfig.UNITS.vmin:
        return (
          (Math.min(this.#rootRect.width, this.#rootRect.height) * value) / 100
        )
      case FrameConfig.UNITS.vmax:
        return (
          (Math.max(this.#rootRect.width, this.#rootRect.height) * value) / 100
        )
    }

    throw new Error(`Unknown unit: ${unit}`)
  }
}
