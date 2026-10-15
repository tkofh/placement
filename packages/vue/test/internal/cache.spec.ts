import { describe, expect, test } from 'vitest'
import { createCache } from '../../src/internal/cache.ts'

describe('createCache', () => {
  test('runs the factory once per key', () => {
    const cache = createCache<string, number>(4)
    let runs = 0
    const factory = () => {
      runs++
      return 42
    }

    expect(cache('a', factory)).toBe(42)
    expect(cache('a', factory)).toBe(42)
    expect(runs).toBe(1)
  })

  test('hits are keyed: a repeated key ignores a different factory', () => {
    const cache = createCache<string, number>(4)

    expect(cache('a', () => 1)).toBe(1)
    expect(cache('b', () => 2)).toBe(2)
    expect(cache('a', () => 3)).toBe(1)
  })

  test('a hit refreshes recency, so insertion evicts the least recently used key', () => {
    const cache = createCache<string, string>(2)
    const runs = { a: 0, b: 0, c: 0 }
    const factory = (key: 'a' | 'b' | 'c') => () => {
      runs[key]++
      return key
    }

    cache('a', factory('a'))
    cache('b', factory('b'))
    cache('a', factory('a')) // hit: 'a' becomes most recent
    cache('c', factory('c')) // over capacity: evicts 'b', the LRU

    cache('a', factory('a')) // still cached
    cache('b', factory('b')) // evicted: reruns

    expect(runs).toEqual({ a: 1, b: 2, c: 1 })
  })

  test('null results are cached: only undefined is treated as a miss', () => {
    const cache = createCache<string, number | null>(4)
    let runs = 0
    const factory = () => {
      runs++
      return null
    }

    expect(cache('a', factory)).toBe(null)
    expect(cache('a', factory)).toBe(null)
    expect(runs).toBe(1)
  })

  test('an undefined result is never a hit: the factory reruns every call', () => {
    // Intended miss semantics: the handler reads a stored `undefined` as
    // absence (its hit check is `!== undefined`), so an undefined-producing
    // factory runs on every call.
    const cache = createCache<string, number | undefined>(4)
    let runs = 0
    const factory = () => {
      runs++
      return undefined
    }

    expect(cache('u', factory)).toBe(undefined)
    expect(cache('u', factory)).toBe(undefined)
    expect(runs).toBe(2)
  })

  test('re-setting an existing key updates in place without evicting', () => {
    // An undefined result still stores a node, so its rerun goes through the
    // update path of `set`. That path skips the size check.
    const cache = createCache<string, number | undefined>(2)
    let aRuns = 0
    const a = () => {
      aRuns++
      return 1
    }

    cache('u', () => undefined)
    cache('a', a)
    cache('u', () => undefined) // existing node: update, no eviction
    cache('a', a)

    expect(aRuns).toBe(1)
  })

  test('an undefined result still occupies an LRU slot', () => {
    // The cache stores it but never returns it, so it exerts eviction
    // pressure on live entries. This is current behavior. In-repo factories
    // return null (which caches) rather than undefined, so this stays
    // theoretical.
    const cache = createCache<string, number | undefined>(2)
    let aRuns = 0
    const a = () => {
      aRuns++
      return 1
    }

    cache('a', a)
    cache('u', () => undefined)
    cache('b', () => 2) // over capacity: evicts 'a', not the dead 'u' entry
    cache('a', a)

    expect(aRuns).toBe(2)
  })
})
