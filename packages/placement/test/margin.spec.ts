import { describe, expect, test } from 'vitest'
import * as Frame from '../src/frame.ts'
import { fields } from '../src/internal/margin.ts'
import * as Margin from '../src/margin.ts'

describe('normalize', () => {
  test('omitted margins are 0', () => {
    expect(Margin.normalize({})).toEqual({
      marginTop: 0,
      marginRight: 0,
      marginBottom: 0,
      marginLeft: 0,
    })
  })

  test('non-finite margins stay auto', () => {
    const auto = Number.POSITIVE_INFINITY
    expect(Margin.normalize({ marginTop: auto, marginLeft: Number.NaN, marginRight: 4 })).toEqual({
      marginTop: auto,
      marginRight: 4,
      marginBottom: 0,
      marginLeft: Number.NaN,
    })
  })
})

describe('fields', () => {
  test('names each margin with its percentage axis', () => {
    expect(fields).toEqual({
      marginTop: 'y',
      marginRight: 'x',
      marginBottom: 'y',
      marginLeft: 'x',
    })
  })
})

test('a frame takes the margin slice', () => {
  const input: Margin.MarginInput = { marginTop: 1, marginLeft: 2 }
  expect(Frame.make(input)).toMatchObject(Margin.normalize(input))
})
