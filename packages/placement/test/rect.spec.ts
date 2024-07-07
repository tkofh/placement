import { inspect } from 'node:util'
import { describe, expect, test } from 'vitest'
import {
  type Rect,
  adjustBottom,
  adjustLeft,
  adjustRight,
  adjustTop,
  align,
  alignBottom,
  alignCenter,
  alignCenterX,
  alignCenterY,
  alignLeft,
  alignRight,
  alignTop,
  clampHeight,
  clampWidth,
  clampX,
  clampY,
  maxHeight,
  maxWidth,
  maxX,
  maxY,
  minHeight,
  minWidth,
  minX,
  minY,
  rect,
  scale,
  scaleX,
  scaleY,
  setBottom,
  setHeight,
  setLeft,
  setPosition,
  setPrecision,
  setRight,
  setSize,
  setTop,
  setWidth,
  setX,
  setY,
  translate,
  translateX,
  translateY,
} from '../src/rect'

// a test case
function c(
  input: Rect,
  operation: (rect: Rect) => Rect,
  output: Rect,
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
    { input: rect(), output: rect(0, 0, 0, 0) },
    { input: rect(10), output: rect(0, 0, 10, 10) },
    { input: rect(10, 20), output: rect(0, 0, 10, 20) },
    { input: rect(10, 20, 30), output: rect(10, 20, 30, 30) },
    { input: rect(10, 20, 30, 40), output: rect(10, 20, 30, 40) },
  ])('rect($input): $output', ({ input, output }) => {
    expect(input).toEqual(output)
  })
})

const zero = rect()
const ten = rect(10)
const thirty = rect(30)
const rect1234 = rect(10, 20, 30, 40)
const rect5678 = rect(50, 60, 70, 80)

describe('setX', () => {
  test(...c(zero, setX(50), rect(50, 0, 0)))
  test(...c(zero, setX(-50), rect(-50, 0, 0)))
})

describe('setY', () => {
  test(...c(zero, setY(50), rect(0, 50, 0)))
  test(...c(zero, setY(-50), rect(0, -50, 0)))
})

describe('setPosition', () => {
  test(...c(zero, setPosition(50), rect(50, 50, 0)))
  test(...c(zero, setPosition(-50), rect(-50, -50, 0)))
  test(...c(zero, setPosition(50, 100), rect(50, 100, 0)))
  test(...c(zero, setPosition(-50, 100), rect(-50, 100, 0)))
})

describe('setSize', () => {
  test(...c(zero, setSize(50), rect(0, 0, 50)))
  test(...c(zero, setSize(50, 100), rect(0, 0, 50, 100)))
})

describe('setWidth', () => {
  test(...c(zero, setWidth(50), rect(0, 0, 50, 0)))
  test(...c(zero, setWidth(100), rect(0, 0, 100, 0)))
})

describe('setHeight', () => {
  test(...c(zero, setHeight(50), rect(0, 0, 0, 50)))
  test(...c(zero, setHeight(100), rect(0, 0, 0, 100)))
})

describe('setPrecision', () => {
  test(
    ...c(
      rect(10.1, 20.2, 30.3, 40.4),
      setPrecision(0),
      rect(10, 20, 30, 40, 0),
    ),
  )
})

describe('setTop', () => {
  test(...c(zero, setTop(10), rect(0, 10, 0)))
  test(...c(zero, setTop(-10), rect(0, -10, 0)))
})

describe('setLeft', () => {
  test(...c(zero, setLeft(10), rect(10, 0, 0)))
  test(...c(zero, setLeft(-10), rect(-10, 0, 0)))
})

describe('setRight', () => {
  test(...c(zero, setRight(10), rect(10, 0, 0)))
  test(...c(zero, setRight(-10), rect(-10, 0, 0)))
  test(...c(ten, setRight(20), rect(10, 0, 10)))
  test(...c(ten, setRight(-20), rect(-30, 0, 10)))
})

describe('setBottom', () => {
  test(...c(zero, setBottom(10), rect(0, 10, 0)))
  test(...c(zero, setBottom(-10), rect(0, -10, 0)))
  test(...c(ten, setBottom(20), rect(0, 10, 10)))
  test(...c(ten, setBottom(-20), rect(0, -30, 10)))
})

describe('translateX', () => {
  test(...c(zero, translateX(10), rect(10, 0, 0)))
  test(...c(zero, translateX(-10), rect(-10, 0, 0)))
})

describe('translateY', () => {
  test(...c(zero, translateY(10), rect(0, 10, 0)))
  test(...c(zero, translateY(-10), rect(0, -10, 0)))
})

describe('translate', () => {
  test(...c(zero, translate(10, 20), rect(10, 20, 0)))
  test(...c(zero, translate(-10, -20), rect(-10, -20, 0)))
})

describe('scaleX', () => {
  test(...c(ten, scaleX(2), rect(20, 10)))
  test(...c(ten, scaleX(2, 0), rect(20, 10)))
  test(...c(ten, scaleX(2, 0.5), rect(-5, 0, 20, 10)))
  test(...c(ten, scaleX(2, 1), rect(-10, 0, 20, 10)))
})

describe('scaleY', () => {
  test(...c(ten, scaleY(2), rect(10, 20)))
  test(...c(ten, scaleY(2, 0), rect(10, 20)))
  test(...c(ten, scaleY(2, 0.5), rect(0, -5, 10, 20)))
  test(...c(ten, scaleY(2, 1), rect(0, -10, 10, 20)))
})

describe('scale', () => {
  test(...c(ten, scale(2), rect(20)))
  test(...c(ten, scale(2, 0), rect(20)))
  test(...c(ten, scale(2, 0.5), rect(-5, -5, 20)))
  test(...c(ten, scale(2, 1), rect(-10, -10, 20)))
})

describe('minX', () => {
  test(...c(zero, minX(20), rect(20, 0, 0)))
  test(...c(zero, minX(0), zero))
  test(...c(zero, minX(-10), zero))
})

describe('maxX', () => {
  test(...c(zero, maxX(20), zero))
  test(...c(zero, maxX(0), zero))
  test(...c(zero, maxX(-10), rect(-10, 0, 0)))
})

describe('clampX', () => {
  test(...c(zero, clampX(10, 30), rect(10, 0, 0)))
  test(...c(zero, clampX(30, 10), rect(10, 0, 0)))

  test(...c(zero, clampX(0, 20), zero))
  test(...c(zero, clampX(20, 0), zero))

  test(...c(zero, clampX(-10, 10), zero))
  test(...c(zero, clampX(10, -10), zero))

  test(...c(zero, clampX(-20, 0), zero))
  test(...c(zero, clampX(0, -20), zero))

  test(...c(zero, clampX(-30, -10), rect(-10, 0, 0)))
  test(...c(zero, clampX(-10, -30), rect(-10, 0, 0)))
})

describe('minY', () => {
  test(...c(zero, minY(20), rect(0, 20, 0)))
  test(...c(zero, minY(0), zero))
  test(...c(zero, minY(-10), zero))
})

describe('maxY', () => {
  test(...c(zero, maxY(20), zero))
  test(...c(zero, maxY(0), zero))
  test(...c(zero, maxY(-10), rect(0, -10, 0)))
})

describe('clampY', () => {
  test(...c(zero, clampY(10, 30), rect(0, 10, 0)))
  test(...c(zero, clampY(30, 10), rect(0, 10, 0)))

  test(...c(zero, clampY(0, 20), zero))
  test(...c(zero, clampY(20, 0), zero))

  test(...c(zero, clampY(-10, 10), zero))
  test(...c(zero, clampY(10, -10), zero))

  test(...c(zero, clampY(-20, 0), zero))
  test(...c(zero, clampY(0, -20), zero))

  test(...c(zero, clampY(-30, -10), rect(0, -10, 0)))
  test(...c(zero, clampY(-10, -30), rect(0, -10, 0)))
})

describe('minWidth', () => {
  test(...c(zero, minWidth(40), rect(40, 0)))
  test(...c(zero, minWidth(0), zero))
  test(...c(ten, minWidth(0), ten))
})

describe('maxWidth', () => {
  test(...c(zero, maxWidth(40), zero))
  test(...c(ten, maxWidth(10), ten))
  test(...c(zero, maxWidth(10), zero))
})

describe('clampWidth', () => {
  test(...c(thirty, clampWidth(40, 60), rect(40, 30)))
  test(...c(thirty, clampWidth(60, 40), rect(40, 30)))

  test(...c(thirty, clampWidth(30, 50), rect(30, 30)))
  test(...c(thirty, clampWidth(50, 30), rect(30, 30)))

  test(...c(thirty, clampWidth(20, 40), rect(30, 30)))
  test(...c(thirty, clampWidth(40, 20), rect(30, 30)))

  test(...c(thirty, clampWidth(10, 30), rect(30, 30)))
  test(...c(thirty, clampWidth(30, 10), rect(30, 30)))

  test(...c(thirty, clampWidth(0, 20), rect(20, 30)))
  test(...c(thirty, clampWidth(20, 0), rect(20, 30)))
})

describe('minHeight', () => {
  test(...c(zero, minHeight(40), rect(0, 40)))
  test(...c(zero, minHeight(0), zero))
  test(...c(ten, minHeight(0), ten))
})

describe('maxHeight', () => {
  test(...c(zero, maxHeight(40), zero))
  test(...c(ten, maxHeight(10), ten))
  test(...c(zero, maxHeight(10), zero))
})

describe('clampHeight', () => {
  test(...c(thirty, clampHeight(40, 60), rect(30, 40)))
  test(...c(thirty, clampHeight(60, 40), rect(30, 40)))

  test(...c(thirty, clampHeight(30, 50), thirty))
  test(...c(thirty, clampHeight(50, 30), thirty))

  test(...c(thirty, clampHeight(20, 40), thirty))
  test(...c(thirty, clampHeight(40, 20), thirty))

  test(...c(thirty, clampHeight(10, 30), thirty))
  test(...c(thirty, clampHeight(30, 10), thirty))

  test(...c(thirty, clampHeight(0, 20), rect(30, 20)))
  test(...c(thirty, clampHeight(20, 0), rect(30, 20)))
})

describe('alignLeft', () => {
  test(...c(rect1234, alignLeft(rect5678), rect(50, 20, 30, 40)))
  test(...c(rect1234, alignLeft(rect(-50, 60, 70, 80)), rect(-50, 20, 30, 40)))
})

describe('alignRight', () => {
  test(...c(rect1234, alignRight(rect5678), rect(90, 20, 30, 40)))
  test(...c(rect1234, alignRight(rect(-50, 60, 70, 80)), rect(-10, 20, 30, 40)))
})

describe('alignTop', () => {
  test(...c(rect1234, alignTop(rect5678), rect(10, 60, 30, 40)))
  test(...c(rect1234, alignTop(rect(50, -60, 70, 80)), rect(10, -60, 30, 40)))
})

describe('alignBottom', () => {
  test(...c(rect1234, alignBottom(rect5678), rect(10, 100, 30, 40)))
  test(
    ...c(rect1234, alignBottom(rect(50, -60, 70, 80)), rect(10, -20, 30, 40)),
  )
})

describe('alignCenterX', () => {
  test(...c(rect1234, alignCenterX(rect5678), rect(70, 20, 30, 40)))
  test(
    ...c(rect1234, alignCenterX(rect(-50, 60, 70, 80)), rect(-30, 20, 30, 40)),
  )
})

describe('alignCenterY', () => {
  test(...c(rect1234, alignCenterY(rect5678), rect(10, 80, 30, 40)))
  test(
    ...c(rect1234, alignCenterY(rect(50, -60, 70, 80)), rect(10, -40, 30, 40)),
  )
})

describe('alignCenter', () => {
  test(...c(rect1234, alignCenter(rect5678), rect(70, 80, 30, 40)))
  test(
    ...c(rect1234, alignCenter(rect(-50, -60, 70, 80)), rect(-30, -40, 30, 40)),
  )
})

describe('align', () => {
  test(...c(rect1234, align(rect5678, 'top'), rect(10, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'right'), rect(90, 20, 30, 40)))
  test(...c(rect1234, align(rect5678, 'bottom'), rect(10, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'left'), rect(50, 20, 30, 40)))
  test(...c(rect1234, align(rect5678, 'center'), rect(70, 80, 30, 40)))
  test(...c(rect1234, align(rect5678, 'top center'), rect(70, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'center top'), rect(70, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'top right'), rect(90, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'right top'), rect(90, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'center right'), rect(90, 80, 30, 40)))
  test(...c(rect1234, align(rect5678, 'right center'), rect(90, 80, 30, 40)))
  test(...c(rect1234, align(rect5678, 'bottom right'), rect(90, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'right bottom'), rect(90, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'bottom center'), rect(70, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'center bottom'), rect(70, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'bottom left'), rect(50, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'left bottom'), rect(50, 100, 30, 40)))
  test(...c(rect1234, align(rect5678, 'center left'), rect(50, 80, 30, 40)))
  test(...c(rect1234, align(rect5678, 'left center'), rect(50, 80, 30, 40)))
  test(...c(rect1234, align(rect5678, 'top left'), rect(50, 60, 30, 40)))
  test(...c(rect1234, align(rect5678, 'left top'), rect(50, 60, 30, 40)))
})

describe('adjustTop', () => {
  test(...c(rect1234, adjustTop(0), rect1234))
  test(...c(rect1234, adjustTop(10), rect(10, 30, 30, 30)))
  test(...c(rect1234, adjustTop(-10), rect(10, 10, 30, 50)))
})

describe('adjustRight', () => {
  test(...c(rect1234, adjustRight(0), rect1234))
  test(...c(rect1234, adjustRight(10), rect(10, 20, 40, 40)))
  test(...c(rect1234, adjustRight(-10), rect(10, 20, 20, 40)))
})

describe('adjustBottom', () => {
  test(...c(rect1234, adjustBottom(0), rect1234))
  test(...c(rect1234, adjustBottom(10), rect(10, 20, 30, 50)))
  test(...c(rect1234, adjustBottom(-10), rect(10, 20, 30, 30)))
})

describe('adjustLeft', () => {
  test(...c(rect1234, adjustLeft(0), rect1234))
  test(...c(rect1234, adjustLeft(10), rect(20, 20, 20, 40)))
  test(...c(rect1234, adjustLeft(-10), rect(0, 20, 40, 40)))
})

/**
 * - resizeTop
 * - resizeBottom
 * - resizeLeft
 * - resizeRight
 * - resizeX
 * - resizeY
 * - resize
 * - join
 * - intersect
 * - contain
 * - cover
 * - crop
 * - fit
 */
