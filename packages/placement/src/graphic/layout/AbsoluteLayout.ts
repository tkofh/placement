import type { GraphicRect } from '../GraphicRect'
import { type Quantity, QuantityProperty } from '../properties/QuantityProperty'
import { Layout } from './Layout'

interface AbsoluteLayoutOptions {
  autoSizeMode?: 'fill' | 'hide'
}

export class AbsoluteLayout extends Layout {
  autoSizeMode: 'fill' | 'hide'

  constructor(base: GraphicRect, options?: AbsoluteLayoutOptions) {
    super(base)

    this.autoSizeMode = options?.autoSizeMode ?? 'fill'
  }

  computeInset(quantity: Quantity | null, basis: number) {
    if (quantity == null) {
      return null
    }
    if (quantity.unit === QuantityProperty.UNITS.percent) {
      return (basis * quantity.value) / 100
    }

    return quantity.value
  }

  computeSize(
    quantity: Quantity | null,
    baseSize: number,
    insetStart: number | null,
    insetEnd: number | null,
  ) {
    if (quantity == null) {
      if (this.autoSizeMode === 'fill') {
        return baseSize - (insetStart ?? 0) - (insetEnd ?? 0)
      }

      if (insetStart !== null && insetEnd !== null) {
        return baseSize - insetStart - insetEnd
      }

      return 0
    }

    if (quantity.unit === QuantityProperty.UNITS.flex) {
      const flexBasis = baseSize - (insetStart ?? insetEnd ?? 0) * 2
      return flexBasis * quantity.value
    }

    if (quantity.unit === QuantityProperty.UNITS.percent) {
      return (baseSize * quantity.value) / 100
    }

    return quantity.value
  }

  layout() {
    for (const [index, config] of this.configs.entries()) {
      const rect = this.rects[index]

      const top = this.computeInset(config.readTop(), this.base.height)
      const right = this.computeInset(config.readRight(), this.base.width)
      const bottom = this.computeInset(config.readBottom(), this.base.height)
      const left = this.computeInset(config.readLeft(), this.base.width)

      const width = this.computeSize(
        config.readWidth(),
        this.base.width,
        left,
        right,
      )
      const height = this.computeSize(
        config.readHeight(),
        this.base.height,
        top,
        bottom,
      )

      const offsetX = this.computeInset(config.readOffsetX(), width) ?? 0
      const offsetY = this.computeInset(config.readOffsetY(), height) ?? 0

      rect.x = this.base.x + (left ?? right ?? 0 + offsetX)
      rect.y = this.base.y + (top ?? bottom ?? 0 + offsetY)
      rect.width = width
      rect.height = height
    }
  }
}
