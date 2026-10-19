import { describe, expect, test } from 'vitest'
import * as Adornment from '../src/adornment.ts'
import * as Connector from '../src/connector.ts'
import * as Edge from '../src/edge.ts'
import * as Frame from '../src/frame.ts'
import * as Rect from '../src/rect.ts'

// Snapshots of whole layouts, over every kind of input, which hold the
// output of `Connector.apply` still through refactors of its pipeline. A
// change here is a change in behavior, and needs a changeset.

const same = (
  rects: Record<string, Rect.Rect>,
  edges: ReadonlyArray<Edge.Edge<string>>,
  spec: Connector.Connector,
  options?: Connector.ConnectorApplyOptions,
) => {
  const layout = Connector.apply(rects, edges, spec, options)
  const lines = layout.edges.map((route, i) => {
    if (route === undefined) {
      return `${i}: none`
    }
    const points = route.points.map((p) => `${p.x},${p.y}`).join(' ')
    const adornments = route.adornments
      .map(
        ({ rect, angle, along }) =>
          `[${rect.x},${rect.y} ${rect.width}x${rect.height} @${angle} ${along.start}+${along.size}]`,
      )
      .join('')
    return `${i}: ${points} | r ${route.radii.join(',')} | o ${route.outsets.join(',')} | m ${route.merged.join(',')} | ${adornments}`
  })
  const notes = layout.notes.map((note) => JSON.stringify(note))
  expect([...lines, ...notes].join('\n')).toMatchSnapshot()
}

const arrow = (at: number, orient: number) =>
  Adornment.make({ frame: Frame.make({ width: 8, height: 6, offsetLeft: 2 }), at, orient })
const label = (at: number, position: number = Adornment.position.flow) =>
  Adornment.make({ frame: Frame.make({ width: 20, height: 10 }), at, position })

describe('snapshots', () => {
  const grid = {
    a: Rect.make(0, 0, 40, 20),
    b: Rect.make(100, 0, 40, 20),
    c: Rect.make(0, 100, 40, 20),
    d: Rect.make(100, 100, 40, 20),
    e: Rect.make(50, 50, 20, 20),
  }

  test('auto sides, ports, and nudging', () => {
    same(
      grid,
      [
        Edge.make({ source: 'a', target: 'b' }),
        Edge.make({ source: 'a', target: 'd' }),
        Edge.make({ source: 'c', target: 'b' }),
        Edge.make({ source: 'c', target: 'd', radius: 8 }),
      ],
      Connector.make({ clearance: 6, gap: 4, bendCost: 20 }),
    )
  })

  test('given ports, via, avoid, and turns', () => {
    same(
      grid,
      [
        Edge.make({ source: 'a', target: 'd', sourceSide: 1, sourceAt: 0.25, targetSide: 0 }),
        Edge.make({ source: 'a', target: 'd', sourceSide: 2, targetSide: 3, targetAt: 0.75 }),
        Edge.make({ source: 'c', target: 'b', radius: 10 }),
      ],
      Connector.make({ clearance: 6, gap: 4, bendCost: 20 }),
      {
        edges: [
          { via: [{ x: 70, y: 30 }] },
          { avoid: [Rect.make(50, 50, 20, 20)], turn: Connector.turn.clockwise },
          { turn: Connector.turn.counterclockwise, jogAt: 0.25 },
        ],
      },
    )
  })

  test('adornments, corners, and slants', () => {
    same(
      grid,
      [
        Edge.make({
          source: 'a',
          target: 'd',
          radius: 12,
          thickness: 2,
          adornments: [arrow(1, Adornment.orient.forward), label(0.5), label(0.3, 1)],
        }),
        Edge.make({
          source: 'c',
          target: 'b',
          radius: 12,
          thickness: 2,
          adornments: [arrow(0, Adornment.orient.backward), label(0.6)],
        }),
        Edge.make({ source: 'a', target: 'b', radius: 30, adornments: [label(0.5)] }),
      ],
      Connector.make({
        clearance: 6,
        gap: 4,
        bendCost: 20,
        adornmentGap: 2,
        justifyAdornments: 0.25,
        justifyAdornmentsSpace: 0.5,
        justifyAdornmentsSpaceOuter: 0.5,
        alignAdornments: 0,
        jogSlant: 2,
      }),
    )
  })

  test.each([Connector.merge.side, Connector.merge.near])('merging %i', (merge) => {
    const head = Adornment.make({ frame: Frame.make({ width: 8, height: 6 }), at: 1, orient: 1 })
    const rects = {
      a: Rect.make(0, 0, 40, 20),
      b: Rect.make(0, 60, 40, 20),
      c: Rect.make(0, 120, 40, 20),
      t: Rect.make(200, 50, 40, 40),
      u: Rect.make(200, 150, 40, 40),
    }
    same(
      rects,
      [
        Edge.make({ source: 'a', target: 't', radius: 10, thickness: 2, adornments: [head] }),
        Edge.make({ source: 'b', target: 't', radius: 10, thickness: 2, adornments: [head] }),
        Edge.make({ source: 'c', target: 't', radius: 10, thickness: 2, adornments: [head] }),
        Edge.make({ source: 'c', target: 'u', radius: 10, thickness: 2, adornments: [head] }),
        Edge.make({ source: 'a', target: 'u', targetSide: 3, targetAt: 0.5, adornments: [head] }),
        Edge.make({ source: 'b', target: 'u', targetSide: 3, targetAt: 0.5, adornments: [head] }),
      ],
      Connector.make({ clearance: 8, gap: 4, bendCost: 20, merge, mergeGap: 2 }),
    )
  })

  test('self loops and unroutable edges', () => {
    same(
      {
        a: Rect.make(0, 0, 40, 20),
        ring: Rect.make(100, 100, 20, 20),
        n: Rect.make(90, 90, 40, 10),
        s: Rect.make(90, 120, 40, 10),
        w: Rect.make(90, 100, 10, 20),
        e: Rect.make(120, 100, 10, 20),
      },
      [
        Edge.make({ source: 'a', target: 'a', radius: 6 }),
        Edge.make({ source: 'a', target: 'a', sourceSide: 2 }),
        Edge.make({ source: 'a', target: 'ring' }),
      ],
      Connector.make({ clearance: 4, gap: 2 }),
    )
  })

  test.each(Array.from({ length: 24 }, (_, i) => i + 1))('random diagram %i', (seed) => {
    let state = seed
    const next = (n: number) => {
      state = (state * 1103515245 + 12345) % 2147483648
      return Math.floor((state / 2147483648) * n)
    }
    const rects: Record<string, Rect.Rect> = {}
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        if (next(4) !== 0) {
          rects[`r${i}${j}`] = Rect.make(
            i * 100 + next(30),
            j * 100 + next(30),
            30 + next(30),
            30 + next(30),
          )
        }
      }
    }
    const ids = Object.keys(rects)
    const edges = Array.from({ length: 8 }, () => {
      const pick = () => ids[next(ids.length)] as string
      const side = () => (next(3) === 0 ? next(4) : undefined)
      const at = () => (next(4) === 0 ? next(3) / 4 + 0.25 : undefined)
      return Edge.make({
        source: pick(),
        target: pick(),
        sourceSide: side(),
        sourceAt: at(),
        targetSide: side(),
        targetAt: at(),
        radius: next(2) === 0 ? 8 : 0,
        thickness: next(2),
        adornments: next(2) === 0 ? [arrow(1, Adornment.orient.forward)] : [label(0.5)],
      })
    })
    same(
      rects,
      edges,
      Connector.make({
        clearance: 6,
        gap: 3,
        bendCost: 20,
        merge: seed % 3,
        jogSlant: seed % 2,
      }),
    )
  })
})
