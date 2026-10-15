import * as Flexbox from 'placement/flexbox'
import { describe, expect, test } from 'vitest'
import { resolveFlow } from '../../../src/internal/props/flow.ts'

describe('undefined', () => {
  test('resolves to the autos', () => {
    expect(resolveFlow(undefined, Flexbox.direction.column, Flexbox.wrap.wrapReverse)).toEqual({
      direction: Flexbox.direction.column,
      wrap: Flexbox.wrap.wrapReverse,
    })
  })

  test('the autos default to row nowrap', () => {
    expect(resolveFlow(undefined)).toEqual({
      direction: Flexbox.direction.row,
      wrap: Flexbox.wrap.nowrap,
    })
  })
})

describe('single keywords', () => {
  // Each case picks an auto for the untouched channel that differs from the
  // keyword's own mapping, so a wrong write-through is visible.
  test.each([
    { input: 'row', expected: Flexbox.direction.row },
    { input: 'row-reverse', expected: Flexbox.direction.rowReverse },
    { input: 'column', expected: Flexbox.direction.column },
    { input: 'column-reverse', expected: Flexbox.direction.columnReverse },
  ])('direction keyword $input leaves wrap at its auto', ({ input, expected }) => {
    expect(resolveFlow(input, Flexbox.direction.row, Flexbox.wrap.wrapReverse)).toEqual({
      direction: expected,
      wrap: Flexbox.wrap.wrapReverse,
    })
  })

  test.each([
    { input: 'nowrap', autoWrap: Flexbox.wrap.wrap, expected: Flexbox.wrap.nowrap },
    { input: 'wrap', autoWrap: Flexbox.wrap.nowrap, expected: Flexbox.wrap.wrap },
    { input: 'wrap-reverse', autoWrap: Flexbox.wrap.nowrap, expected: Flexbox.wrap.wrapReverse },
  ])('wrap keyword $input leaves direction at its auto', ({ input, autoWrap, expected }) => {
    expect(resolveFlow(input, Flexbox.direction.columnReverse, autoWrap)).toEqual({
      direction: Flexbox.direction.columnReverse,
      wrap: expected,
    })
  })
})

describe('combined keywords', () => {
  test('direction and wrap resolve together', () => {
    expect(resolveFlow('column wrap')).toEqual({
      direction: Flexbox.direction.column,
      wrap: Flexbox.wrap.wrap,
    })
  })

  test('keyword order is irrelevant', () => {
    expect(resolveFlow('wrap column')).toEqual(resolveFlow('column wrap'))
  })

  test('reversed pair', () => {
    expect(resolveFlow('row-reverse wrap-reverse')).toEqual({
      direction: Flexbox.direction.rowReverse,
      wrap: Flexbox.wrap.wrapReverse,
    })
  })
})

describe('invalid input', () => {
  test.each(['garbage', 'row column', 'wrap nowrap', 'row row', ''])(
    '%j falls back to the autos',
    (input) => {
      expect(resolveFlow(input, Flexbox.direction.column, Flexbox.wrap.wrap)).toEqual({
        direction: Flexbox.direction.column,
        wrap: Flexbox.wrap.wrap,
      })
    },
  )
})
