import { inspect } from 'node:util'
import { describe, expect, test } from 'vitest'
import {
  type Dimensions,
  aspectRatio,
  clamp,
  clampHeight,
  clampWidth,
  contain,
  cover,
  dimensions,
  height,
  maxHeight,
  maxSize,
  maxWidth,
  minHeight,
  minSize,
  minWidth,
  mix,
  precision,
  scale,
  scaleTo,
  scaleToHeight,
  scaleToWidth,
  scaleX,
  scaleY,
  width,
} from '../src/dimensions'

function c(
  input: Dimensions,
  operation: (dimensions: Dimensions) => Dimensions,
  output: Dimensions,
) {
  return [
    `${inspect(input)} -> ${inspect(output)}`,
    () => {
      expect(operation(input)).toEqual(output)
    },
  ] as const
}

describe('basic cases', () => {
  test.each([
    [dimensions(), dimensions(0, 0)],
    [dimensions(-100), dimensions(100, 100)],
    [dimensions(-100, -100), dimensions(100, 100)],
    [dimensions(0), dimensions(0, 0)],
    [dimensions(100), dimensions(100, 100)],
    [dimensions(0, 0), dimensions(0, 0)],
    [dimensions(100, 100), dimensions(100, 100)],
  ] as const)('%j === %j', (input, output) => {
    expect(input).toEqual(output)
  })
})

describe('width', () => {
  test(...c(dimensions(), width(100), dimensions(100, 0)))
  test(...c(dimensions(100), width(200), dimensions(200, 100)))
})

describe('height', () => {
  test(...c(dimensions(), height(100), dimensions(0, 100)))
  test(...c(dimensions(100), height(200), dimensions(100, 200)))
})

describe('precision', () => {
  test(
    ...c(
      dimensions(177.77777778, 100),
      precision(2),
      dimensions(177.78, 100, 2),
    ),
  )
})

describe('minWidth', () => {
  test(...c(dimensions(), minWidth(100), dimensions(100, 0)))
  test(...c(dimensions(100), minWidth(100), dimensions(100, 100)))
  test(...c(dimensions(200), minWidth(100), dimensions(200, 200)))
})

describe('maxWidth', () => {
  test(...c(dimensions(), maxWidth(100), dimensions(0, 0)))
  test(...c(dimensions(100), maxWidth(100), dimensions(100, 100)))
  test(...c(dimensions(200), maxWidth(100), dimensions(100, 200)))
})

describe('minHeight', () => {
  test(...c(dimensions(), minHeight(100), dimensions(0, 100)))
  test(...c(dimensions(100), minHeight(100), dimensions(100, 100)))
  test(...c(dimensions(100), minHeight(200), dimensions(100, 200)))
})

describe('maxHeight', () => {
  test(...c(dimensions(), maxHeight(100), dimensions(0, 0)))
  test(...c(dimensions(100), maxHeight(100), dimensions(100, 100)))
  test(...c(dimensions(200), maxHeight(100), dimensions(200, 100)))
})

describe('minSize', () => {
  test(...c(dimensions(), minSize(100), dimensions(100, 100)))
  test(...c(dimensions(), minSize(dimensions(100, 100)), dimensions(100, 100)))
  test(...c(dimensions(100), minSize(100), dimensions(100, 100)))
  test(
    ...c(dimensions(100), minSize(dimensions(100, 100)), dimensions(100, 100)),
  )
  test(...c(dimensions(200), minSize(100), dimensions(200, 200)))
  test(
    ...c(dimensions(200), minSize(dimensions(100, 100)), dimensions(200, 200)),
  )
})

describe('maxSize', () => {
  test(...c(dimensions(), maxSize(100), dimensions(0, 0)))
  test(...c(dimensions(), maxSize(dimensions(100, 100)), dimensions(0, 0)))
  test(...c(dimensions(100), maxSize(100), dimensions(100, 100)))
  test(
    ...c(dimensions(100), maxSize(dimensions(100, 100)), dimensions(100, 100)),
  )
  test(...c(dimensions(200), maxSize(100), dimensions(100, 100)))
  test(
    ...c(dimensions(200), maxSize(dimensions(100, 100)), dimensions(100, 100)),
  )
})

describe('clampWidth', () => {
  test(...c(dimensions(50), clampWidth(100, 200), dimensions(100, 50)))
  test(...c(dimensions(100), clampWidth(100, 200), dimensions(100, 100)))
  test(...c(dimensions(150), clampWidth(100, 200), dimensions(150, 150)))
  test(...c(dimensions(200), clampWidth(100, 200), dimensions(200, 200)))
  test(...c(dimensions(250), clampWidth(100, 200), dimensions(200, 250)))
})

describe('clampHeight', () => {
  test(...c(dimensions(50), clampHeight(100, 200), dimensions(50, 100)))
  test(...c(dimensions(100), clampHeight(100, 200), dimensions(100, 100)))
  test(...c(dimensions(150), clampHeight(100, 200), dimensions(150, 150)))
  test(...c(dimensions(200), clampHeight(100, 200), dimensions(200, 200)))
  test(...c(dimensions(250), clampHeight(100, 200), dimensions(250, 200)))
})

describe('clamp', () => {
  test(...c(dimensions(50), clamp(100, 200), dimensions(100, 100)))
  test(
    ...c(
      dimensions(50),
      clamp(100, dimensions(200, 200)),
      dimensions(100, 100),
    ),
  )
  test(
    ...c(
      dimensions(50),
      clamp(dimensions(100, 100), 200),
      dimensions(100, 100),
    ),
  )
  test(
    ...c(
      dimensions(50),
      clamp(dimensions(100, 100), dimensions(200, 200)),
      dimensions(100, 100),
    ),
  )

  test(...c(dimensions(100), clamp(100, 200), dimensions(100, 100)))
  test(
    ...c(
      dimensions(100),
      clamp(100, dimensions(200, 200)),
      dimensions(100, 100),
    ),
  )
  test(
    ...c(
      dimensions(100),
      clamp(dimensions(100, 100), 200),
      dimensions(100, 100),
    ),
  )
  test(
    ...c(
      dimensions(100),
      clamp(dimensions(100, 100), dimensions(200, 200)),
      dimensions(100, 100),
    ),
  )

  test(...c(dimensions(150), clamp(100, 200), dimensions(150, 150)))
  test(
    ...c(
      dimensions(150),
      clamp(100, dimensions(200, 200)),
      dimensions(150, 150),
    ),
  )
  test(
    ...c(
      dimensions(150),
      clamp(dimensions(100, 100), 200),
      dimensions(150, 150),
    ),
  )
  test(
    ...c(
      dimensions(150),
      clamp(dimensions(100, 100), dimensions(200, 200)),
      dimensions(150, 150),
    ),
  )

  test(...c(dimensions(200), clamp(100, 200), dimensions(200, 200)))
  test(
    ...c(
      dimensions(200),
      clamp(100, dimensions(200, 200)),
      dimensions(200, 200),
    ),
  )
  test(
    ...c(
      dimensions(200),
      clamp(dimensions(100, 100), 200),
      dimensions(200, 200),
    ),
  )
  test(
    ...c(
      dimensions(200),
      clamp(dimensions(100, 100), dimensions(200, 200)),
      dimensions(200, 200),
    ),
  )

  test(...c(dimensions(250), clamp(100, 200), dimensions(200, 200)))
  test(
    ...c(
      dimensions(250),
      clamp(100, dimensions(200, 200)),
      dimensions(200, 200),
    ),
  )
  test(
    ...c(
      dimensions(250),
      clamp(dimensions(100, 100), 200),
      dimensions(200, 200),
    ),
  )
  test(
    ...c(
      dimensions(250),
      clamp(dimensions(100, 100), dimensions(200, 200)),
      dimensions(200, 200),
    ),
  )
})

describe('aspectRatio', () => {
  test(...c(dimensions(100), aspectRatio.fixWidth(2), dimensions(100, 50)))
  test(...c(dimensions(100), aspectRatio.fixHeight(2), dimensions(200, 100)))
  test(...c(dimensions(100), aspectRatio(2), dimensions(150, 75)))
  test(...c(dimensions(100), aspectRatio(2, 0, 0), dimensions(150, 75)))
  test(...c(dimensions(100), aspectRatio(2, 1, 1), dimensions(150, 75)))
  test(...c(dimensions(100), aspectRatio(2, 0.75, 0.25), dimensions(175, 87.5)))
  test(...c(dimensions(100), aspectRatio(2, 0.25, 0.75), dimensions(125, 62.5)))
})

describe('scale', () => {
  test(...c(dimensions(100), scale(2), dimensions(200, 200)))
  test(...c(dimensions(100), scale(2, 0.5), dimensions(200, 50)))
  test(...c(dimensions(100), scale(-1), dimensions(100, 100)))
  test(...c(dimensions(100), scale(-2), dimensions(200, 200)))
})

describe('scaleX', () => {
  test(...c(dimensions(100), scaleX(2), dimensions(200, 100)))
  test(...c(dimensions(100), scaleX(0.5), dimensions(50, 100)))
  test(...c(dimensions(100), scaleX(-1), dimensions(100, 100)))
  test(...c(dimensions(100), scaleX(-2), dimensions(200, 100)))
})

describe('scaleY', () => {
  test(...c(dimensions(100), scaleY(2), dimensions(100, 200)))
  test(...c(dimensions(100), scaleY(0.5), dimensions(100, 50)))
  test(...c(dimensions(100), scaleY(-1), dimensions(100, 100)))
  test(...c(dimensions(100), scaleY(-2), dimensions(100, 200)))
})

describe('scaleTo', () => {
  test(...c(dimensions(100), scaleTo(256), dimensions(16)))
  test(...c(dimensions(75, 100), scaleTo(300), dimensions(15, 20)))
})

describe('scaleToWidth', () => {
  test(...c(dimensions(100, 50), scaleToWidth(200), dimensions(200, 100)))
  test(...c(dimensions(100, 50), scaleToWidth(150), dimensions(150, 75)))
})

describe('scaleToHeight', () => {
  test(...c(dimensions(100, 50), scaleToHeight(200), dimensions(400, 200)))
  test(...c(dimensions(100, 50), scaleToHeight(150), dimensions(300, 150)))
})

describe('contain', () => {
  test(...c(dimensions(100), contain(2), dimensions(100, 50)))
  test(...c(dimensions(100), contain(0.5), dimensions(50, 100)))
  test(...c(dimensions(100), contain(16 / 9), dimensions(100, 56.25)))
})

describe('cover', () => {
  test(...c(dimensions(100), cover(2), dimensions(200, 100)))
  test(...c(dimensions(100), cover(0.5), dimensions(100, 200)))
  test(...c(dimensions(100), cover(16 / 9), dimensions(177.77777778, 100)))
})

describe('mix', () => {
  test(
    ...c(
      dimensions(100, 100),
      mix(dimensions(200, 200), 0),
      dimensions(100, 100),
    ),
  )
  test(
    ...c(
      dimensions(100, 100),
      mix(dimensions(200, 200), 0.5),
      dimensions(150, 150),
    ),
  )
  test(
    ...c(
      dimensions(100, 100),
      mix(dimensions(200, 200), 1),
      dimensions(200, 200),
    ),
  )
})
