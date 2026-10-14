import * as Flexbox from 'placement/flexbox'
import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { type FlowInput, useFlow } from '../../src/props/flow.ts'

describe('useFlow', () => {
  test('the default fallback is row/nowrap', () => {
    expect(useFlow(() => undefined).value).toEqual({
      direction: Flexbox.direction.row,
      wrap: Flexbox.wrap.nowrap,
    })
  })

  test('an explicit fallback fills unset channels', () => {
    const fallback = { direction: Flexbox.direction.column, wrap: Flexbox.wrap.wrap }

    expect(useFlow(() => undefined, fallback).value).toEqual(fallback)
    // The input sets only the direction; the wrap channel falls back.
    expect(useFlow(() => 'row-reverse', fallback).value).toEqual({
      direction: Flexbox.direction.rowReverse,
      wrap: Flexbox.wrap.wrap,
    })
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<FlowInput>('row')
    const flow = useFlow(input)

    const first = flow.value
    expect(first).toEqual({ direction: Flexbox.direction.row, wrap: Flexbox.wrap.nowrap })

    // A different string resolving to equal channels: recomputed, same
    // instance.
    input.value = 'row nowrap'
    expect(flow.value).toBe(first)

    input.value = 'column wrap'
    expect(flow.value).not.toBe(first)
    expect(flow.value).toEqual({
      direction: Flexbox.direction.column,
      wrap: Flexbox.wrap.wrap,
    })
  })
})
