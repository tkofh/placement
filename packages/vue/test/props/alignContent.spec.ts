import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { keywordResults } from '../../src/internal/props/alignContent.ts'
import { type AlignContentInput, useAlignContent } from '../../src/props/alignContent.ts'

describe('useAlignContent', () => {
  test('undefined input returns the fallback values', () => {
    expect(useAlignContent(() => undefined).value).toEqual(keywordResults.start)
    expect(useAlignContent(() => undefined, keywordResults['space-around']).value).toEqual(
      keywordResults['space-around'],
    )
  })

  test('keywords resolve through keywordResults', () => {
    expect(useAlignContent(() => 'space-evenly').value).toEqual(keywordResults['space-evenly'])
  })

  test('a numeric input keeps the fallback space channels', () => {
    expect(useAlignContent(() => 0.5, keywordResults['space-between']).value).toEqual({
      alignContent: 0.5,
      alignContentSpace: 1,
      alignContentSpaceOuter: 0,
      stretchContent: 0,
    })
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<AlignContentInput>('start')
    const alignContent = useAlignContent(input)

    const first = alignContent.value
    expect(first).toEqual(keywordResults.start)

    // A different string resolving to equal values: recomputed, same
    // instance.
    input.value = 'place 0'
    expect(alignContent.value).toBe(first)

    input.value = 'end'
    expect(alignContent.value).not.toBe(first)
    expect(alignContent.value).toEqual(keywordResults.end)
  })
})
