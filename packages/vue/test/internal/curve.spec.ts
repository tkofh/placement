import { QuadraticCurve2d } from 'curvy/curve'
import { CubicPath2d, LinearPath2d, QuadraticPath2d } from 'curvy/path'
import { Basis2d, Bezier2d, Cardinal2d, Hermite2d, Linear2d, RationalBezier2d } from 'curvy/splines'
import { Affine2d } from 'curvy/transform'
import { Vector2 } from 'curvy/vector'
import { describe, expect, test } from 'vitest'
import {
  type PathInput,
  type RenderablePath,
  finiteNumber,
  normalizePath,
  pathBounds,
  pathData,
  transformPath,
} from '../../src/internal/curve.ts'

const tolerance = 0.1

function linearPath(): LinearPath2d.LinearPath2d {
  return Linear2d.toPath(
    Linear2d.fromTuples([
      [0, 0],
      [4, 8],
    ]),
  )
}

function cubicPath(): CubicPath2d.CubicPath2d {
  return Bezier2d.toPath(
    Bezier2d.fromTuples([
      [0, 0],
      [1, 2],
      [3, 2],
      [4, 0],
    ]),
  )
}

function quadraticPath(): QuadraticPath2d.QuadraticPath2d {
  return QuadraticPath2d.fromArray([
    QuadraticCurve2d.fromBezierPoints(Vector2.make(0, 0), Vector2.make(1, 2), Vector2.make(4, 0)),
  ])
}

function rationalBezier(): RationalBezier2d.RationalBezier2d {
  return RationalBezier2d.fromPoints(
    Vector2.make(0, 0),
    Vector2.make(1, 2),
    Vector2.make(3, 2),
    Vector2.make(4, 0),
  )
}

describe('normalizePath', () => {
  test.each([
    {
      name: 'Linear2d spline',
      input: () =>
        Linear2d.fromTuples([
          [0, 0],
          [4, 8],
        ]),
      kind: 'linear',
    },
    {
      name: 'Bezier2d spline',
      input: () =>
        Bezier2d.fromTuples([
          [0, 0],
          [1, 2],
          [3, 2],
          [4, 0],
        ]),
      kind: 'cubic',
    },
    {
      name: 'Cardinal2d spline',
      input: () =>
        Cardinal2d.fromTuples([
          [0, 0],
          [1, 2],
          [3, 2],
          [4, 0],
        ]),
      kind: 'cubic',
    },
    {
      name: 'Hermite2d spline',
      input: () =>
        Hermite2d.fromTuples([
          [0, 0],
          [1, 0],
          [4, 8],
          [1, 0],
        ]),
      kind: 'cubic',
    },
    {
      name: 'Basis2d spline',
      input: () =>
        Basis2d.fromTuples([
          [0, 0],
          [1, 2],
          [3, 2],
          [4, 0],
        ]),
      kind: 'cubic',
    },
    { name: 'RationalBezier2d spline', input: rationalBezier, kind: 'cubic' },
    {
      name: 'RationalCubicPath2d',
      input: () => RationalBezier2d.toPath(rationalBezier()),
      kind: 'cubic',
    },
  ])('$name normalizes to kind $kind', ({ input, kind }) => {
    expect(normalizePath(input(), tolerance)?.kind).toBe(kind)
  })

  test.each([
    { name: 'LinearPath2d', path: linearPath, kind: 'linear' },
    { name: 'QuadraticPath2d', path: quadraticPath, kind: 'quadratic' },
    { name: 'CubicPath2d', path: cubicPath, kind: 'cubic' },
  ])('$name passes through by identity', ({ path, kind }) => {
    const input = path()
    const renderable = normalizePath(input, tolerance)

    expect(renderable?.kind).toBe(kind)
    expect(renderable?.path).toBe(input)
  })

  test('rational forms approximate into genuine cubic paths', () => {
    const renderable = normalizePath(rationalBezier(), tolerance)

    expect(renderable?.kind).toBe('cubic')
    expect(CubicPath2d.isCubicPath2d(renderable?.path)).toBe(true)
  })

  test('a non-path object is null', () => {
    expect(normalizePath({} as PathInput, tolerance)).toBe(null)
  })
})

describe('transformPath', () => {
  test('translate moves pathData and pathBounds without touching the input', () => {
    const renderable = normalizePath(linearPath(), tolerance)
    if (renderable === null) {
      throw new Error('expected a renderable path')
    }

    const moved = transformPath(renderable, Affine2d.translate(10, 5))

    expect(moved.kind).toBe('linear')
    expect(pathData(moved)).toBe('M 10,5 L 14,13')
    const bounds = pathBounds(moved)
    expect([bounds.x.start, bounds.x.end]).toEqual([10, 14])
    expect([bounds.y.start, bounds.y.end]).toEqual([5, 13])

    expect(pathData(renderable)).toBe('M 0,0 L 4,8')
  })
})

describe('pathData / pathBounds', () => {
  test('a linear renderable routes through LinearPath2d', () => {
    const path = linearPath()
    const renderable: RenderablePath = { kind: 'linear', path }

    expect(pathData(renderable)).toBe(LinearPath2d.toPathData(path))
    expect(pathBounds(renderable)).toEqual(LinearPath2d.boundingBox(path))
  })

  test.each([
    { kind: 'linear', renderable: () => ({ kind: 'linear', path: linearPath() }) as const },
    {
      kind: 'quadratic',
      renderable: () => ({ kind: 'quadratic', path: quadraticPath() }) as const,
    },
    { kind: 'cubic', renderable: () => ({ kind: 'cubic', path: cubicPath() }) as const },
  ])('the $kind kind emits usable path data and bounds', ({ renderable }) => {
    const value = renderable()

    expect(pathData(value)).toMatch(/^M /)
    const bounds = pathBounds(value)
    expect([bounds.x.start, bounds.x.end]).toEqual([0, 4])
    expect(bounds.y.start).toBe(0)
  })
})

describe('finiteNumber', () => {
  const cases: Array<{ value: number | string | undefined; expected: number | undefined }> = [
    { value: 2, expected: 2 },
    { value: '1.5', expected: 1.5 },
    { value: undefined, expected: undefined },
    { value: 'x', expected: undefined },
    { value: 'Infinity', expected: undefined },
    { value: Number.NaN, expected: undefined },
    { value: Number.POSITIVE_INFINITY, expected: undefined },
  ]

  test.each(cases)('finiteNumber($value) -> $expected', ({ value, expected }) => {
    expect(finiteNumber(value as Parameters<typeof finiteNumber>[0])).toBe(expected)
  })

  test('the bare-attribute empty string parses as 0, not unset', () => {
    // `Number('') === 0`: a bare numeric attribute (`grow=""`) resolves to 0.
    // Outside the declared input type, but reachable from templates.
    expect(finiteNumber('' as `${number}`)).toBe(0)
  })
})
