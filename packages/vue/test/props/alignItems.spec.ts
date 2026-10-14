import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { keywordResults } from '../../src/internal/props/alignItems.ts'
import { type AlignItemsInput, useAlignItems } from '../../src/props/alignItems.ts'

describe('useAlignItems', () => {
  test('undefined input returns the fallback values', () => {
    expect(useAlignItems(() => undefined).value).toEqual(keywordResults.start)
    expect(useAlignItems(() => undefined, keywordResults.stretch).value).toEqual(
      keywordResults.stretch,
    )
  })

  test('keywords resolve through keywordResults', () => {
    expect(useAlignItems(() => 'center').value).toEqual(keywordResults.center)
  })

  test('a numeric input keeps the fallback stretch channel', () => {
    expect(useAlignItems(() => 0.5, keywordResults.stretch).value).toEqual({
      alignItems: 0.5,
      stretchItems: 1,
    })
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<AlignItemsInput>('start')
    const alignItems = useAlignItems(input)

    const first = alignItems.value
    expect(first).toEqual(keywordResults.start)

    // A different string resolving to equal values: recomputed, same
    // instance.
    input.value = 'place 0'
    expect(alignItems.value).toBe(first)

    input.value = 'end'
    expect(alignItems.value).not.toBe(first)
    expect(alignItems.value).toEqual(keywordResults.end)
  })
})
