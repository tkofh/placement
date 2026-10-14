import { describe, expect, test } from 'vitest'
import { Fill, type FillInput, resolveFill } from '../../../src/internal/props/fill.ts'

describe('parsing', () => {
  // A resolved Fill carries the kebab-case SVG presentation attribute names,
  // so an instance spreads verbatim onto an SVG element's attrs.
  test.each<{ input: FillInput; expected: Record<string, string> }>([
    { input: 'red', expected: { fill: 'color(srgb 1 0 0)' } },
    { input: '#ff0000', expected: { fill: 'color(srgb 1 0 0)' } },
    { input: 'none', expected: { fill: 'transparent' } },
    { input: 'red evenodd', expected: { fill: 'color(srgb 1 0 0)', 'fill-rule': 'evenodd' } },
    { input: 'evenodd red', expected: { fill: 'color(srgb 1 0 0)', 'fill-rule': 'evenodd' } },
    { input: 'nonzero #00f', expected: { fill: 'color(srgb 0 0 1)', 'fill-rule': 'nonzero' } },
  ])('resolveFill($input): $expected', ({ input, expected }) => {
    expect(resolveFill(input)).toEqual(expected)
  })

  test('non-dyadic channels are string equality on the serialized form', () => {
    expect(resolveFill('rgb(1 2 3)')).toEqual({ fill: 'color(srgb 0.00392 0.00784 0.01176)' })
  })

  test('a fill-rule alone resolves with no color, leaving the inherited fill alone', () => {
    expect(resolveFill('evenodd')).toEqual({ 'fill-rule': 'evenodd' })
  })
})

describe('auto fallback', () => {
  test('undefined resolves to the auto value, Fill.empty by default', () => {
    expect(resolveFill(undefined)).toBe(Fill.empty)

    const auto = new Fill('color(srgb 0 0 0)')
    expect(resolveFill(undefined, auto)).toBe(auto)
  })

  test('invalid input falls back to the auto value', () => {
    expect(resolveFill('garbage')).toBe(Fill.empty)

    const auto = new Fill('transparent')
    expect(resolveFill('garbage', auto)).toBe(auto)
  })
})
