import { type Point, isPoint, point } from 'placement/point'
import { type ParserInput, type ParserValue, parse } from 'valued'
import { allOf } from 'valued/combinators/allOf'
import { juxtapose } from 'valued/combinators/juxtapose'
import { oneOf } from 'valued/combinators/oneOf'
import { isKeywordValue, keywords } from 'valued/data/keyword'
import { isNumberValue, number } from 'valued/data/number'
import { isPercentageValue, percentage } from 'valued/data/percentage'
import { createCache } from '../cache'

const origin = oneOf([
  keywords(['top', 'right', 'bottom', 'left', 'center']),
  percentage(),
  number({ min: 0, max: 1 }),
  allOf([
    keywords(['left', 'center', 'right']),
    keywords(['top', 'center', 'bottom']),
  ]),
  juxtapose([
    oneOf([
      keywords(['left', 'center', 'right']),
      oneOf([percentage(), number({ min: 0, max: 1 })]),
    ]),
    oneOf([
      keywords(['top', 'center', 'bottom']),
      oneOf([percentage(), number({ min: 0, max: 1 })]),
    ]),
  ]),
  allOf([
    juxtapose([
      keywords(['left', 'right']),
      oneOf([percentage(), number({ min: 0, max: 1 })]),
    ]),
    juxtapose([
      keywords(['top', 'bottom']),
      oneOf([percentage(), number({ min: 0, max: 1 })]),
    ]),
  ]),
])

export type Origin = typeof origin

export type OriginInput = ParserInput<Origin> | Point | number | undefined

export type OriginValue = ParserValue<Origin>

const cache = createCache<string, Point>(512)

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: will be simpler soon
function normalize(value: OriginValue) {
  if (isKeywordValue(value)) {
    switch (value.value) {
      case 'center':
        return point(0.5)
      case 'left':
        return point(0, 0.5)
      case 'right':
        return point(1, 0.5)
      case 'top':
        return point(0.5, 0)
      case 'bottom':
        return point(0.5, 1)
    }
  }

  if (isPercentageValue(value)) {
    return point(value.value / 100)
  }

  if (isNumberValue(value)) {
    return point(value.value)
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

  return point(x, y)
}

export function resolveOrigin(
  input: OriginInput,
  auto: Point = point.zero,
): Point {
  if (isPoint(input)) {
    return input
  }

  if (typeof input === 'number') {
    return point(input, input)
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
