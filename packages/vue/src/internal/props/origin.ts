import * as Point from 'placement/point'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { allOf } from 'valued'
import { juxtapose } from 'valued'
import { oneOf } from 'valued'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { isNumberValue, number } from 'valued/data/number'
import { isPercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache.ts'

const origin = oneOf([
  keywords(['top', 'right', 'bottom', 'left', 'center']),
  percentage(),
  number(),
  allOf([keywords(['left', 'center', 'right']), keywords(['top', 'center', 'bottom'])]),
  juxtapose([
    oneOf([keywords(['left', 'center', 'right']), oneOf([percentage(), number()])]),
    oneOf([keywords(['top', 'center', 'bottom']), oneOf([percentage(), number()])]),
  ]),
  allOf([
    juxtapose([keywords(['left', 'right']), oneOf([percentage(), number()])]),
    juxtapose([keywords(['top', 'bottom']), oneOf([percentage(), number()])]),
  ]),
])

export type Origin = typeof origin

export type OriginInput = ParserInput<Origin> | Point.Point | number | undefined

export type OriginValue = ParserValue<Origin>

const cache = createCache<string, Point.Point>(512)

function normalize(value: OriginValue) {
  if (isKeywordValue(value)) {
    switch (value.value) {
      case 'center':
        return Point.make(0.5)
      case 'left':
        return Point.make(0, 0.5)
      case 'right':
        return Point.make(1, 0.5)
      case 'top':
        return Point.make(0.5, 0)
      case 'bottom':
        return Point.make(0.5, 1)
    }
  }

  if (isPercentageValue(value)) {
    return Point.make(value.value / 100)
  }

  if (isNumberValue(value)) {
    return Point.make(value.value)
  }

  const [first, second] = value

  let x = 0.5
  let y = 0.5

  if (isKeywordValue(first)) {
    if (first.value === 'left') {
      x = 0
    } else if (first.value === 'right') {
      x = 1
    }
  } else if (isPercentageValue(first)) {
    x = first.value / 100
  } else if (isNumberValue(first)) {
    x = first.value
  } else if (Array.isArray(first)) {
    const [edge, offset] = first

    if (edge.value === 'left') {
      x = offset.value / 100
    } else {
      x = 1 - offset.value / 100
    }
  }

  if (isKeywordValue(second)) {
    if (second.value === 'top') {
      y = 0
    } else if (second.value === 'bottom') {
      y = 1
    }
  } else if (isPercentageValue(second)) {
    y = second.value / 100
  } else if (isNumberValue(second)) {
    y = second.value
  } else if (Array.isArray(second)) {
    const [edge, offset] = second

    if (edge.value === 'top') {
      y = offset.value / 100
    } else {
      y = 1 - offset.value / 100
    }
  }

  return Point.make(x, y)
}

export function resolveOrigin(input: OriginInput, auto: Point.Point = Point.zero): Point.Point {
  if (Point.isPoint(input)) {
    return input
  }

  if (typeof input === 'number') {
    return Point.make(input, input)
  }

  if (input === undefined) {
    return auto
  }

  return cache(`${input.toString()}:${auto.x}:${auto.y}`, () => {
    const parsed = parse(input, origin)

    if (!parsed.valid) {
      return auto
    }

    return normalize(parsed.value)
  })
}
