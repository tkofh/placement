import { describe, expect, test } from 'vitest'
import { ref } from 'vue'
import { keywordResults } from '../../src/internal/props/justifyContent.ts'
import { type JustifyContentInput, useJustifyContent } from '../../src/props/justifyContent.ts'

describe('useJustifyContent', () => {
  test('undefined input returns the fallback values', () => {
    expect(useJustifyContent(() => undefined).value).toEqual(keywordResults.start)
    expect(useJustifyContent(() => undefined, keywordResults['space-evenly']).value).toEqual(
      keywordResults['space-evenly'],
    )
  })

  test('keywords resolve through keywordResults', () => {
    expect(useJustifyContent(() => 'space-between').value).toEqual(keywordResults['space-between'])
  })

  test('a numeric input zeroes the space channels, ignoring the fallback', () => {
    // Unlike useAlignContent, the numeric path spreads keywordResults.start
    // rather than the fallback autos. Current behavior -- the two resolvers
    // disagree here.
    expect(useJustifyContent(() => 0.25, keywordResults['space-between']).value).toEqual({
      justifyContent: 0.25,
      justifyContentSpace: 0,
      justifyContentSpaceOuter: 0,
    })
  })

  test('equal recomputes keep the cached instance', () => {
    const input = ref<JustifyContentInput>('start')
    const justifyContent = useJustifyContent(input)

    const first = justifyContent.value
    expect(first).toEqual(keywordResults.start)

    // A different string resolving to equal values: recomputed, same
    // instance.
    input.value = 'place 0'
    expect(justifyContent.value).toBe(first)

    input.value = 'end'
    expect(justifyContent.value).not.toBe(first)
    expect(justifyContent.value).toEqual(keywordResults.end)
  })
})
