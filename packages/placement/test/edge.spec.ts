import { describe, expect, test } from 'vitest'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'

const label = Frame.make({ width: 40, height: 16 })

describe('edge', () => {
  test('make applies the defaults', () => {
    const edge = Edge.make({ source: 'a', target: 'b' })
    expect(edge.source).toBe('a')
    expect(edge.target).toBe('b')
    expect(edge.weight).toBe(1)
    expect(edge.minLength).toBe(1)
    expect(edge.sourceSide).toBe(Number.POSITIVE_INFINITY)
    expect(edge.sourceAt).toBe(Number.POSITIVE_INFINITY)
    expect(edge.targetSide).toBe(Number.POSITIVE_INFINITY)
    expect(edge.targetAt).toBe(Number.POSITIVE_INFINITY)
    expect(edge.labels).toEqual([])
  })

  test('ids keep their literal types', () => {
    const edge: Edge.Edge<'a' | 'b'> = Edge.make({ source: 'a', target: 'b' })
    // setSource adds the new id to the type.
    const moved: Edge.Edge<'a' | 'b' | 'c'> = edge.pipe(Edge.setSource('c'))
    expect(moved.source).toBe('c')
    // @ts-expect-error -- 'c' is not among the ids of `edge`
    const narrow: Edge.Edge<'a' | 'b'> = moved
    expect(narrow.target).toBe('b')
  })

  test('isEdge accepts edges and rejects everything else', () => {
    expect(Edge.isEdge(Edge.make({ source: 'a', target: 'b' }))).toBe(true)
    expect(Edge.isEdge({ source: 'a', target: 'b' })).toBe(false)
    expect(Edge.isEdge(null)).toBe(false)
    expect(Edge.isEdge(label)).toBe(false)
  })

  test('side encodes the four physical sides', () => {
    expect(Edge.side).toEqual({ top: 0, right: 1, bottom: 2, left: 3 })
  })

  test('a JSON round trip keeps auto ports auto', () => {
    const edge = Edge.make({ source: 'a', target: 'b', sourceSide: Edge.side.right, weight: 2 })
    const revived = Edge.make(JSON.parse(JSON.stringify(edge)))
    expect(revived.sourceSide).toBe(Edge.side.right)
    expect(revived.sourceAt).toBe(Number.POSITIVE_INFINITY)
    expect(revived.targetSide).toBe(Number.POSITIVE_INFINITY)
    expect(revived.weight).toBe(2)
  })

  const base = Edge.make({ source: 'a', target: 'b' })

  test.each([
    ['setSource', Edge.setSource(base, 'c'), base.pipe(Edge.setSource('c')), 'source', 'c'],
    ['setTarget', Edge.setTarget(base, 'c'), base.pipe(Edge.setTarget('c')), 'target', 'c'],
    ['setWeight', Edge.setWeight(base, 3), base.pipe(Edge.setWeight(3)), 'weight', 3],
    ['setMinLength', Edge.setMinLength(base, 2), base.pipe(Edge.setMinLength(2)), 'minLength', 2],
  ] as const)('%s works in both forms', (_, dataFirst, dataLast, field, value) => {
    expect(dataFirst[field]).toBe(value)
    expect(dataLast[field]).toBe(value)
    expect(base[field]).not.toBe(value)
  })

  test('setSourcePort sets the side and an optional position', () => {
    const full = Edge.setSourcePort(base, Edge.side.right, 0.25)
    const sideOnly = base.pipe(Edge.setSourcePort(Edge.side.bottom))
    const dataLast = base.pipe(Edge.setSourcePort(Edge.side.left, 0.75))
    expect([full.sourceSide, full.sourceAt]).toEqual([1, 0.25])
    expect([sideOnly.sourceSide, sideOnly.sourceAt]).toEqual([2, Number.POSITIVE_INFINITY])
    expect([dataLast.sourceSide, dataLast.sourceAt]).toEqual([3, 0.75])
    expect(Edge.setSourcePort(base, Edge.side.top).sourceAt).toBe(Number.POSITIVE_INFINITY)
  })

  test('setTargetPort sets the side and an optional position', () => {
    const full = Edge.setTargetPort(base, Edge.side.top, 0.5)
    const dataLast = base.pipe(Edge.setTargetPort(Edge.side.left))
    expect([full.targetSide, full.targetAt]).toEqual([0, 0.5])
    expect([dataLast.targetSide, dataLast.targetAt]).toEqual([3, Number.POSITIVE_INFINITY])
  })

  test('setLabels replaces and addLabel appends', () => {
    const replaced = Edge.setLabels(base, [{ frame: label, at: 0.25 }])
    expect(replaced.labels).toEqual([{ frame: label, at: 0.25 }])
    expect(base.pipe(Edge.setLabels([])).labels).toEqual([])

    const appended = Edge.addLabel(replaced, label)
    expect(appended.labels).toHaveLength(2)
    expect(appended.labels[1]?.frame).toBe(label)
    expect(appended.labels[1]?.at).toBeUndefined()
    expect(replaced.pipe(Edge.addLabel(label, 1)).labels[1]?.at).toBe(1)
  })

  test('setters keep the other fields', () => {
    const edge = Edge.make({ source: 'a', target: 'b', weight: 5, labels: [{ frame: label }] })
    const updated = Edge.setTargetPort(edge, Edge.side.top)
    expect(updated.weight).toBe(5)
    expect(updated.labels).toHaveLength(1)
    expect(updated.source).toBe('a')
  })
})
