import { describe, expect, test } from 'vitest'
import { type PortInput, resolvePort } from '../../../src/internal/props/port.ts'

const auto = Number.POSITIVE_INFINITY

describe('resolvePort', () => {
  test.each([
    [undefined, auto, auto],
    ['auto', auto, auto],
    ['top', 0, auto],
    ['right', 1, auto],
    ['bottom', 2, auto],
    ['left', 3, auto],
    ['25%', auto, 0.25],
    ['0.75', auto, 0.75],
    ['right 25%', 1, 0.25],
    ['25% right', 1, 0.25],
    ['auto 0.5', auto, 0.5],
  ] as const)('%s resolves to side %s at %s', (input, side, at) => {
    expect(resolvePort(input)).toEqual({ side, at })
  })

  test('invalid input resolves to a fully auto port', () => {
    expect(resolvePort('sideways' as PortInput)).toEqual({ side: auto, at: auto })
  })
})
