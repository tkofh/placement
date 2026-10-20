import { describe, expect, test } from 'vitest'
import { normalize } from '../src/internal/connector/problem.ts'
import { scoreLayout } from '../src/internal/connector/score.ts'
import { type RenderName, type SceneName, layoutOf, sceneOf } from './fixtures/judgements.ts'

// The score against the eye: pairs of renders of one scene, each judged by
// looking at both, with what decided it. The score must prefer the better
// of each pair. A pair it gets wrong means a term is missing, and the
// weights do not bend to win it back.

interface Judgement {
  readonly id: number
  readonly scene: SceneName
  readonly better: RenderName
  readonly worse: RenderName
  readonly why: string
}

const judgements: ReadonlyArray<Judgement> = [
  {
    id: 1,
    scene: 'case1',
    better: 'group-final/case1',
    worse: 'v2-before/case1',
    why: 'mailer and indexer loop round the zone where the routes into db merge, with harsh corners',
  },
  {
    id: 2,
    scene: 'case3',
    better: 'group-final/case3',
    worse: 'v2-before/case3',
    why: 'mailer runs over auth->db and orders->db',
  },
  {
    id: 3,
    scene: 'case2',
    better: 'group-slide/case2',
    worse: 'v2-before/case2',
    why: 'auth->db and billing->db take steps of 7.41, jogs with no reason to be there',
  },
  {
    id: 4,
    scene: 'case4',
    better: 'group-final/case4',
    worse: 'v2-before/case4',
    why: 'mailer jogs where it has no need to',
  },
  {
    id: 5,
    scene: 'case5',
    better: 'case5-head/case5',
    worse: 'case5/case5',
    why: 'gateway->auth and auth->db run over each other, and a route steps 20 into db',
  },
  {
    id: 6,
    scene: 'case6',
    better: 'group-final/case6',
    worse: 'case6-head/case6',
    why: 'kinks, the routes out of orders leave in the wrong order, and so do those into db',
  },
  {
    id: 7,
    scene: 'case6',
    better: 'group-final/case6',
    worse: 'canon/case6',
    why: "gateway->auth hooks round auth's corner into its left side, rather than coming straight into its top",
  },
  {
    id: 9,
    scene: 'default',
    better: 'group-final/default',
    worse: 'v2b-after/default',
    why: 'a whisk steps 32 into db, nearly upright, and mailer runs inside the bundle into db',
  },
  {
    id: 10,
    scene: 'diabolical',
    better: 'canon/diabolical',
    worse: 'group-final/diabolical',
    why: 'the worse is busier to look at, and crowds a channel',
  },
  {
    id: 11,
    scene: 'case2',
    better: 'group-slide/case2',
    worse: 'v2c-after/case2',
    why: 'the steps of pair 3 come back',
  },
]

const scoreOf = (scene: SceneName, render: RenderName) => {
  const { rects, edges, spec } = sceneOf(scene)
  return scoreLayout(normalize(rects, edges, spec), layoutOf(render))
}

describe('the score agrees with the eye', () => {
  test.each(judgements)('pair $id, $scene: $better over $worse, where $why', (judgement) => {
    const better = scoreOf(judgement.scene, judgement.better)
    const worse = scoreOf(judgement.scene, judgement.worse)
    expect(better.total).toBeLessThan(worse.total)
  })

  // Pair 8 is a tie. The grouping's render is cleaner round gateway->auth,
  // which comes straight into auth's top where the canonical render hooks
  // round its corner into its left side (pair 7's defect, which the score
  // charges only as a tight corner); the canonical render is cleaner in
  // the column on the right, with two crossings and a crowded note fewer.
  // The eye goes either way, so nothing is asserted about the order; the
  // pair stays to show what a change to the score does to it.
  test('pair 8, case3: group-final/case3 against canon/case3, a tie', () => {
    const grouping = scoreOf('case3', 'group-final/case3')
    const canonical = scoreOf('case3', 'canon/case3')
    expect(grouping.terms.unrouted + canonical.terms.unrouted).toBe(0)
  })
})
