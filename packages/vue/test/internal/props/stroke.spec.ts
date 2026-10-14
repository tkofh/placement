import { describe, expect, test } from 'vitest'
import { Stroke, resolveStroke } from '../../../src/internal/props/stroke.ts'

describe('parsing', () => {
  // A resolved Stroke carries the kebab-case SVG presentation attribute
  // names, so an instance spreads verbatim onto an SVG element's attrs.
  test.each<{ input: string; parentWidth: number; expected: Record<string, string> }>([
    { input: 'red', parentWidth: 100, expected: { stroke: 'color(srgb 1 0 0)' } },
    { input: 'blue', parentWidth: 100, expected: { stroke: 'color(srgb 0 0 1)' } },
    {
      input: 'red 2px',
      parentWidth: 100,
      expected: { stroke: 'color(srgb 1 0 0)', 'stroke-width': '2px' },
    },
    {
      input: 'red 10%',
      parentWidth: 200,
      expected: { stroke: 'color(srgb 1 0 0)', 'stroke-width': '20px' },
    },
    { input: 'red solid', parentWidth: 100, expected: { stroke: 'color(srgb 1 0 0)' } },
    {
      input: 'red dashed 4 2',
      parentWidth: 100,
      expected: { stroke: 'color(srgb 1 0 0)', 'stroke-dasharray': '4 2' },
    },
    {
      // Negative dash segments are absolute-valued; the dash offset keeps
      // its sign.
      input: 'red dashed 4 -2 offset 1',
      parentWidth: 100,
      expected: {
        stroke: 'color(srgb 1 0 0)',
        'stroke-dasharray': '4 2',
        'stroke-dashoffset': '1',
      },
    },
    {
      input: 'red dashed 4 offset -3',
      parentWidth: 100,
      expected: {
        stroke: 'color(srgb 1 0 0)',
        'stroke-dasharray': '4',
        'stroke-dashoffset': '-3',
      },
    },
    {
      input: 'red join bevel',
      parentWidth: 100,
      expected: { stroke: 'color(srgb 1 0 0)', 'stroke-linejoin': 'bevel' },
    },
    {
      input: 'red join round 4',
      parentWidth: 100,
      expected: {
        stroke: 'color(srgb 1 0 0)',
        'stroke-linejoin': 'round',
        'stroke-miterlimit': '4',
      },
    },
    {
      input: 'red cap square',
      parentWidth: 100,
      expected: { stroke: 'color(srgb 1 0 0)', 'stroke-linecap': 'square' },
    },
    {
      input: 'red 2px join round 4 cap square dashed 4 -2 offset 1',
      parentWidth: 100,
      expected: {
        stroke: 'color(srgb 1 0 0)',
        'stroke-width': '2px',
        'stroke-dasharray': '4 2',
        'stroke-dashoffset': '1',
        'stroke-linecap': 'square',
        'stroke-linejoin': 'round',
        'stroke-miterlimit': '4',
      },
    },
  ])('resolveStroke($input, $parentWidth): $expected', ({ input, parentWidth, expected }) => {
    expect(resolveStroke(input, parentWidth)).toEqual(expected)
  })
})

describe('empty results', () => {
  test('a colorless declaration resolves to Stroke.empty', () => {
    expect(resolveStroke('2px', 100)).toBe(Stroke.empty)
  })

  test('invalid input resolves to Stroke.empty', () => {
    expect(resolveStroke('garbage', 100)).toBe(Stroke.empty)
  })

  test('a unitless width invalidates the whole declaration', () => {
    // Widths are `px`/`%` only; the bare `3` fails the parse outright rather
    // than being ignored, so even the color is dropped.
    expect(resolveStroke('red 3', 100)).toBe(Stroke.empty)
  })
})

describe('caching', () => {
  test('repeated resolution returns the cached instance', () => {
    expect(resolveStroke('red 2px', 100)).toBe(resolveStroke('red 2px', 100))
  })

  test('the cache key includes the parent width, so a width change is never a stale hit', () => {
    expect(resolveStroke('red 50%', 200)).toEqual({
      stroke: 'color(srgb 1 0 0)',
      'stroke-width': '100px',
    })
    expect(resolveStroke('red 50%', 400)).toEqual({
      stroke: 'color(srgb 1 0 0)',
      'stroke-width': '200px',
    })
  })
})
