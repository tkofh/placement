import { inspect } from 'node:util'
import { describe, expect, test } from 'vitest'
import {
  type Point,
  avoid,
  bottomCorner,
  center,
  delta,
  fromPolar,
  leftCorner,
  mix,
  orbit,
  point,
  polarMix,
  rightCorner,
  setX,
  setY,
  topCorner,
  translate,
  translateX,
  translateY,
} from '../src/point'

function c(
  input: Point,
  operation: (track: Point) => Point,
  output: Point,
): [string, () => void] {
  return [
    `${inspect(input)}: ${inspect(output)}`,
    () => {
      expect(operation(input)).toEqual(output)
    },
  ]
}

describe('basic cases', () => {
  test.each([
    { input: point(), output: point(0, 0) },
    { input: point(100), output: point(100, 100) },
    { input: point(100, 100), output: point(100, 100) },
    { input: point(100, 100, 100), output: point(100, 100, 100) },
    { input: fromPolar(0, 0), output: point(0, 0) },
    { input: fromPolar(100, 0), output: point(100, 0) },
    { input: fromPolar(100, 0.25), output: point(0, 100) },
    { input: fromPolar(100, 0.5), output: point(-100, 0) },
    { input: fromPolar(100, 0.75), output: point(0, -100) },
    { input: fromPolar(100, 1), output: point(100, 0) },
    { input: fromPolar(100, 1.25), output: point(0, 100) },
    {
      input: center([
        point(0, 100),
        point(100, 0),
        point(0, -100),
        point(-100, 0),
      ]),
      output: point(0, 0),
    },
    {
      input: leftCorner(point(0, 100), point(100, 0)),
      output: point(0, 0),
    },
    {
      input: leftCorner(point(100, 0), point(-100, -100)),
      output: point(-100, 0),
    },
    {
      input: rightCorner(point(0, 100), point(100, 0)),
      output: point(100, 100),
    },
    {
      input: rightCorner(point(100, 0), point(-100, -100)),
      output: point(100, -100),
    },
    {
      input: topCorner(point(0, 100), point(100, 0)),
      output: point(100, 100),
    },
    {
      input: topCorner(point(100, 0), point(-100, -100)),
      output: point(-100, 0),
    },
    {
      input: bottomCorner(point(0, 100), point(100, 0)),
      output: point(0, 0),
    },
    {
      input: bottomCorner(point(100, 0), point(-100, -100)),
      output: point(100, -100),
    },
  ])('point($input): $output', ({ input, output }) => {
    expect(input).toEqual(output)
  })
})

describe('setX', () => {
  test(...c(point(), setX(100), point(100, 0)))
  test(...c(point(100), setX(200), point(200, 100)))
})

describe('setY', () => {
  test(...c(point(), setY(100), point(0, 100)))
  test(...c(point(100), setY(200), point(100, 200)))
})

describe('translateX', () => {
  test(...c(point(), translateX(100), point(100, 0)))
  test(...c(point(100), translateX(200), point(300, 100)))
})

describe('translateY', () => {
  test(...c(point(), translateY(100), point(0, 100)))
  test(...c(point(100), translateY(200), point(100, 300)))
})

describe('translate', () => {
  test(...c(point(), translate(100, 200), point(100, 200)))
  test(...c(point(100, 100), translate(200, 300), point(300, 400)))
})

describe('mix', () => {
  test(...c(point(), mix(point(100, 100), 0.5), point(50, 50)))
  test(...c(point(100, 100), mix(point(200, 200), 0.5), point(150, 150)))
  test(...c(point(100, 100), mix(point(200, 200), 0), point(100, 100)))
  test(...c(point(100, 100), mix(point(200, 200), 1), point(200, 200)))
})

describe('polarMix', () => {
  test(...c(point(0, 100), polarMix(point(0, -100), 0.5), point(100, 0)))
  test(...c(point(0, 100), polarMix(point(100, 0), 0.5), fromPolar(100, 0.125)))
})

describe('delta', () => {
  test(...c(point(0, 100), delta(point(100, 0)), point(-100, 100)))
  test(...c(point(), delta(point(100, 0)), point(-100, 0)))
})

describe('orbit', () => {
  test(...c(point(0, 100), orbit(point(), 0.5), point(0, -100)))
  test(...c(point(0, 100), orbit(point(100, 0), 0.25), point(0, -100)))
  test(...c(point(0, 100), orbit(point(100, 0), 1.25), point(0, -100)))
})

describe('avoid', () => {
  test(...c(point(5, 0), avoid(point(0, 0), 10), point(10, 0)))
  test(...c(point(-5, 0), avoid(point(0, 0), 10), point(-10, 0)))
  test(...c(point(0, 0), avoid(point(0, 0), 10), point(10, 0)))
  test(
    ...c(
      fromPolar(10, 0.125),
      avoid(fromPolar(10, 0.125), 10),
      fromPolar(20, 0.125),
    ),
  )
})
