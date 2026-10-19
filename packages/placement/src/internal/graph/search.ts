import { RELATIVE_TOLERANCE, coincident } from 'curvy/number'
import type { PointLike } from '../../point.ts'
import { before } from '../../utils/tolerance.ts'
import { positiveLength } from '../orient.ts'
import type { Graph, Obstacle } from './graph.ts'

// Shortest paths on a graph of points, for a cost of weighted length plus a
// cost per turn. A turn depends on the heading a path arrives with, so the
// search's state is the half-edge it arrived along, not the node. Waypoints
// add layers of that state: a path at its next waypoint moves to the next
// layer at no cost, so one search finds the best route through all of them,
// with the turns at the waypoints counted. The search is A*, with an
// estimate of the remaining cost that never exceeds it, and never drops by
// more than a step costs: the distance to the next waypoint plus the
// distances between the rest, by the sum of the axis distances on a graph
// whose edges are all horizontal or vertical, and in a straight line
// otherwise, plus the least the turns to the next waypoint can cost.
//
// Two edges run straight on when their cross product is within rounding of
// zero, relative to their lengths, and their dot product is positive.
//
// With a corner radius, two turns one way and then the other around a run
// shorter than twice the radius, a jog whose corners could not both fit, cost
// in proportion to the run: nothing at no length, two turns at twice the
// radius, so that the cost of a route varies smoothly as the rects move and
// no route flips to another over a jog of a pixel. The search pays for a
// turn as the run past it grows, by how much of twice the radius the run has
// covered, and completes the payment when the run turns the same way again,
// grows past that, or reaches the end; a turn the other way instead pays for
// itself what the first has paid, so the pair costs its share and nothing
// more. For that the state carries, along with the half-edge, where a run
// shorter than twice the radius began and which way the turn there went,
// which the search lays out once per graph and radius.
//
// A path may start at any of several endpoints and end at any of several,
// each with the headings it allows and a cost of its own, so one search can
// choose a port, and weigh the ports against the paths to them. A path that
// arrives at an end with a cost is not done: it moves to a final state that
// costs that much more, and pops when nothing cheaper is left.
//
// A path that runs straight on through a node where other paths run
// straight on the other way crosses them, at a cost each, and so does one
// that runs straight on through a node where another path ends, arriving
// or leaving the other way, since what that path leads to past its end
// goes on its way. So does a path that jogs across a run that other paths
// run straight along at both ends of the jog, since it comes onto their
// line from one side and leaves to the other. A path that steps off its
// line by a jog shorter than twice the radius and back onto it by another
// the other way pays, at the turn that brings it back, for the counts of
// the nodes on the line from where it left to where it is back, as a path
// running straight along the line would, less what the way around paid for
// the paths it crossed: a dodge pays what it dodged. A jog onto another
// line for good pays nothing for the line it left. The state does not hold
// where the path left the line, so the search finds it by walking the path
// back from the turn; of two paths into one state, the search keeps the
// cheaper, which may owe a dodge the other would not, so with crossings
// counted the path it finds is not always the cheapest. The estimate
// leaves crossings out, so it stays a lower bound.
//
// A path may also run along its partners' paths for less: their half-edges
// cost a share less of their length, and the estimate takes that share off
// every length, so it stays a lower bound.
//
// Costs are float sums, so comparing them uses `coincident`. A path replaces
// another only when it is cheaper beyond rounding, or as cheap with fewer
// turns, and the queue pops equal costs in the order they were pushed, so
// remaining ties go to the first path found, which follows the order of
// each node's edges.

export interface Endpoint {
  readonly node: number
  // The headings the path may leave or arrive with, as vectors of any
  // length. Any heading when omitted.
  readonly headings?: ReadonlyArray<PointLike> | undefined
  // Added to the cost of a path that starts or ends here. Negative and
  // non-finite values act as `0`, the default.
  readonly cost?: number | undefined
}

export interface SearchOptions {
  // The cost of each turn. Defaults to `0`.
  readonly bendCost?: number
  // Added to the cost of each clockwise or counterclockwise turn, as seen on
  // screen, where the Y axis points down. Both default to `0`.
  readonly clockwiseCost?: number
  readonly counterclockwiseCost?: number
  // The nodes the path passes through, in order.
  readonly via?: ReadonlyArray<number>
  // The way the path heads as it arrives at each node of `via`, and as it
  // leaves, as vectors of any length, or `undefined` for any. Any, by
  // default.
  readonly viaArrivals?: ReadonlyArray<PointLike | undefined>
  readonly viaLeavings?: ReadonlyArray<PointLike | undefined>
  // Rects whose interior the path may not cross. It may run along their
  // edges.
  readonly avoid?: ReadonlyArray<Obstacle>
  // The cost of each crossing, where the path runs straight on through a
  // node that other paths run straight on through the other way, or jogs
  // across a run that other paths run straight along at both ends of the
  // jog, or steps around such a node and back onto its line (see
  // `radius`). Defaults to `0`.
  readonly crossingCost?: number
  // How many other paths run straight on through each node, or end there,
  // at `2 * node` horizontally and `2 * node + 1` vertically, on a graph
  // whose edges are all horizontal or vertical (see `markThrough`).
  readonly through?: ArrayLike<number>
  // The share of its length that a half-edge costs less where `partners`
  // marks it, from `0` to `1`. Defaults to `0`.
  readonly partnerDiscount?: number
  // The half-edges that partner paths run along, each marked nonzero.
  readonly partners?: ArrayLike<number>
  // The radius of the path's corners, on a graph whose edges are all
  // horizontal or vertical. Two turns, one way and then the other, around a
  // run shorter than twice the radius cost in proportion to the run, as the
  // corners could not both fit on it: nothing for a run of no length, and
  // two full turns for one of twice the radius. Defaults to `0`, where every
  // turn costs in full.
  readonly radius?: number
}

export interface Path {
  // The nodes along the path, from start to end.
  readonly nodes: Int32Array
  readonly cost: number
  // The endpoints the path starts and ends at, by index.
  readonly start: number
  readonly end: number
}

/**
 * Finds the cheapest path from any of the starts to any of the ends. Among
 * paths of equal cost, the one with fewer turns wins. A path never reverses
 * along its own heading. An edge between coincident points has no heading,
 * so a turn across it is free.
 *
 * @param graph - The graph to search.
 * @param from - The start node, or the endpoints the path may start at.
 * @param to - The end node, or the endpoints the path may end at.
 * @param options - The costs and constraints of the path.
 * @returns The cheapest path, or `undefined` when no path meets the
 * constraints. Its cost includes the costs of its endpoints. A path from a
 * node to itself, through waypoints at that node, is that node alone, at
 * the cost of its endpoints, when the end allows any heading.
 */
export function shortestPath(
  graph: Graph,
  from: number | ReadonlyArray<Endpoint>,
  to: number | ReadonlyArray<Endpoint>,
  options: SearchOptions = {},
): Path | undefined {
  const { xs, ys, offsets, sources, targets, weights } = graph
  const weightOf = (e: number) => (weights === undefined ? 1 : (weights[e] as number))
  const { dxs, dys } = spansOf(graph)
  const dxOf = (e: number) => dxs[e] as number
  const dyOf = (e: number) => dys[e] as number
  const nodeCount = xs.length
  const valid = (node: number) => Number.isInteger(node) && node >= 0 && node < nodeCount
  const starts = endpoints(from)
  const ends = endpoints(to)
  const via = options.via ?? []
  const ways = (list: ReadonlyArray<PointLike | undefined>) =>
    list.map((heading) => (heading === undefined ? undefined : headings([heading])))
  const viaArrivals = ways(options.viaArrivals ?? [])
  const viaLeavings = ways(options.viaLeavings ?? [])
  if (
    starts.length === 0 ||
    ends.length === 0 ||
    ![...starts, ...ends].every(({ node }) => valid(node)) ||
    !via.every(valid)
  ) {
    return undefined
  }
  // Whether a path heading along (dx, dy) arrives at the waypoint of `leg`
  // the way it holds, if it holds one.
  const alongVia = (leg: number, dx: number, dy: number, length: number) =>
    matches(viaArrivals[leg], dx, dy, length)
  const bendCost = positiveLength(options.bendCost)
  const clockwiseCost = bendCost + positiveLength(options.clockwiseCost)
  const counterclockwiseCost = bendCost + positiveLength(options.counterclockwiseCost)
  const crossingCost = graph.orthogonal ? positiveLength(options.crossingCost) : 0
  const through = crossingCost > 0 ? options.through : undefined
  const discount = Math.min(positiveLength(options.partnerDiscount), 1)
  const partners = discount > 0 ? options.partners : undefined
  const radius = graph.orthogonal ? positiveLength(options.radius) : 0
  // A run shorter than this cannot hold the corners of the turns at its
  // ends.
  const reach = 2 * radius
  const { stride, base, edgeOf, originStart, originNode, originRun } = layoutFor(graph, radius)
  // How much of the cost of the turn onto a run the run has paid by
  // `length`, only asked of runs shorter than the reach.
  const share = (length: number) => Math.min(1, length / reach)
  // What a turn costs, clockwise (`0`) or counterclockwise (`1`).
  const costOfTurn = (way: number) => (way === 0 ? clockwiseCost : counterclockwiseCost)
  // What a unit of length costs at least.
  const least = graph.minWeight * (partners === undefined ? 1 : 1 - discount)
  // What half-edge `e` costs along its length.
  const lengthCost = (e: number, length: number) =>
    length *
    weightOf(e) *
    (partners !== undefined && (partners[e] as number) !== 0 ? 1 - discount : 1)
  const avoid = (options.avoid ?? []).filter(
    (r) =>
      Number.isFinite(r.left) &&
      Number.isFinite(r.top) &&
      Number.isFinite(r.right) &&
      Number.isFinite(r.bottom),
  )

  // Leg `k` leads to waypoint `k`, and the last leg to the ends.
  const lastLeg = via.length
  const legCount = lastLeg + 1
  // The first leg from `leg` on whose waypoint is not `node`.
  const passed = (leg: number, node: number) => {
    let next = leg
    while (next < lastLeg && via[next] === node) {
      next++
    }
    return next
  }
  // Whether end `end` at `node` allows arriving along (dx, dy).
  const arrives = (end: Resolved, node: number, dx: number, dy: number, length: number) =>
    end.node === node && matches(end.headings, dx, dy, length)

  // A start that is an end, with every waypoint there, is a path of one
  // node: the cheapest such pair of endpoints, the first among ties.
  let trivial: Path | undefined
  for (const [index, start] of starts.entries()) {
    if (passed(0, start.node) !== lastLeg) {
      continue
    }
    for (const [end, e] of ends.entries()) {
      const total = start.cost + e.cost
      if (
        e.node === start.node &&
        e.headings === undefined &&
        (trivial === undefined || before(total, trivial.cost))
      ) {
        trivial = { nodes: Int32Array.of(start.node), cost: total, start: index, end }
      }
    }
  }
  if (trivial !== undefined) {
    return trivial
  }

  const distance = graph.orthogonal
    ? (a: number, b: number) =>
        Math.abs((xs[a] as number) - (xs[b] as number)) +
        Math.abs((ys[a] as number) - (ys[b] as number))
    : (a: number, b: number) =>
        Math.hypot((xs[a] as number) - (xs[b] as number), (ys[a] as number) - (ys[b] as number))
  const toEnd = (node: number) => {
    let nearest = Number.POSITIVE_INFINITY
    for (const end of ends) {
      nearest = Math.min(nearest, distance(node, end.node))
    }
    return nearest
  }
  // The least that the turns from `node`, heading along (hx, hy), to
  // `target` can cost, in turns, on a graph whose edges are horizontal or
  // vertical, with no turn part paid: none when the target lies straight
  // ahead; when it lies ahead or level off to one side, one turn, or the two
  // of a jog that far over where that costs less; and when it lies behind,
  // one turn and the two of a jog that far back, since a path turns in full
  // once to head across and may step back the rest of the way. Going
  // straight never lowers the count, and a turn lowers it by no more than
  // the turn costs, so the estimate stays a lower bound that A* can trust.
  // Within rounding, a target counts as aligned and ahead, the lower count.
  const turnsTo = (node: number, target: number, hx: number, hy: number) => {
    const dx = (xs[target] as number) - (xs[node] as number)
    const dy = (ys[target] as number) - (ys[node] as number)
    const band = RELATIVE_TOLERANCE * (Math.abs(dx) + Math.abs(dy))
    const forward = dx * hx + dy * hy
    if (forward < -band) {
      return 1 + jogTo(-forward)
    }
    const across = Math.abs(dx * hy - dy * hx)
    return across <= band ? 0 : jogTo(across)
  }
  // The least that stepping `offset` across costs, in turns: one, or the two
  // turns of a jog that long where they cost less.
  const jogTo = (offset: number) => (radius > 0 ? Math.min(1, offset / radius) : 1)
  const turnCost = graph.orthogonal ? bendCost : 0
  // What is left after reaching the waypoint of each leg.
  const rest = new Float64Array(legCount)
  for (let leg = lastLeg - 1; leg >= 0; leg--) {
    const at = via[leg] as number
    rest[leg] =
      leg === lastLeg - 1
        ? toEnd(at)
        : (rest[leg + 1] as number) + distance(at, via[leg + 1] as number)
  }
  // A lower bound on the cost left from the state at `slot` of a leg. A
  // state part way through paying for the turn onto its run either pays the
  // rest, or turns back the way it came for what it has paid so far, so the
  // least of those two ways bounds it.
  const estimate = (leg: number, slot: number) => {
    const e = edgeOf[slot] as number
    const node = targets[e] as number
    const hx = Math.sign(dxOf(e))
    const hy = Math.sign(dyOf(e))
    const turning = turnCost > 0 && (hx !== 0 || hy !== 0)
    const way = slot - (base[e] as number)
    const count = (originStart[e + 1] as number) - (originStart[e] as number)
    // A state still paying for the turn onto its run: what it has paid, and
    // the way it was heading before that turn.
    const paying = way >= 3 && way <= 2 + 2 * count
    let paid = 1
    let gx = 0
    let gy = 0
    if (paying) {
      paid = share(originRun[(originStart[e] as number) + ((way - 3) >> 1)] as number)
      ;[gx, gy] = cameFrom((way - 3) & 1, hx, hy)
    }
    const turns = (target: number) => {
      if (!turning) {
        return 0
      }
      const onward = turnsTo(node, target, hx, hy)
      return (
        turnCost *
        (paying ? Math.min(1 - paid + onward, paid + turnsTo(node, target, gx, gy)) : onward)
      )
    }
    if (leg < lastLeg) {
      const at = via[leg] as number
      return least * (distance(node, at) + (rest[leg] as number)) + turns(at)
    }
    let best = Number.POSITIVE_INFINITY
    for (const end of ends) {
      best = Math.min(best, least * distance(node, end.node) + turns(end.node))
    }
    return best
  }

  // The states past the last leg: one per end, which a path that arrives
  // at an end with a cost moves to, for that cost more.
  const final = legCount * stride
  const { cost, bends, parent, seen, done, round, queue } = scratchFor(graph, final + ends.length)
  queue.clear()

  // Whether each half-edge may be used: 0 unknown, 1 open, 2 closed.
  const usable = new Uint8Array(targets.length)
  const open = (e: number) => {
    if (usable[e] === 0) {
      const weight = weightOf(e)
      const a = sources[e] as number
      const b = targets[e] as number
      const blocked =
        weight === Number.POSITIVE_INFINITY ||
        avoid.some((region) =>
          crosses(region, xs[a] as number, ys[a] as number, xs[b] as number, ys[b] as number),
        )
      usable[e] = blocked ? 2 : 1
    }
    return usable[e] === 1
  }

  // What a path in `state` that turns at `node` onto the heading (hx, hy),
  // the second turn of a jog, stepped around, in crossings: when the jog
  // brings it back onto the line it left by a jog the other way, both
  // within the reach, what the nodes on that line from where it left to
  // where it is back would have cost a path running straight along it,
  // less the crossings the way around paid, and nothing when the way around
  // paid as much. Nothing either when the line between them is not a run of
  // open edges, since the path could not have stayed on it.
  const dodged = (state: number, node: number, hx: number, hy: number): number => {
    if (through === undefined) {
      return 0
    }
    const back = edgeOf[state % stride] as number
    const jx = Math.sign(dxOf(back))
    const jy = Math.sign(dyOf(back))
    // The headings of the runs back from here: the jog back, the stretch
    // beside the line, the jog away, and the line itself.
    const ways = [jx, jy, hx, hy, -jx, -jy, hx, hy]
    const lengths = [0, 0, 0]
    // The nodes of the way around, from here back to where it left.
    const around = [node]
    let group = 0
    let previous = -1
    let left = -1
    for (let current = state; current !== -1; current = parent[current] as number) {
      const e = edgeOf[current % stride] as number
      if (e === previous) {
        continue
      }
      previous = e
      const ex = Math.sign(dxOf(e))
      const ey = Math.sign(dyOf(e))
      if (ex === 0 && ey === 0) {
        continue
      }
      if (ex !== ways[2 * group] || ey !== ways[2 * group + 1]) {
        group++
        if (group > 3 || ex !== ways[2 * group] || ey !== ways[2 * group + 1]) {
          return 0
        }
        if (group === 3) {
          left = targets[e] as number
          break
        }
      }
      const total = (lengths[group] as number) + lengthOf(dxOf(e), dyOf(e))
      if (group !== 1 && !before(total, reach)) {
        return 0
      }
      lengths[group] = total
      around.push(sources[e] as number)
    }
    const across = hy === 0 ? ys : xs
    if (left < 0 || !coincident(across[left] as number, across[node] as number)) {
      return 0
    }
    // What the way around paid: the paths it ran straight across, and the
    // two jogs, each across the paths that run along its line at both ends.
    const count = (at: number, slot: number) => through[2 * at + slot] ?? 0
    const jog = jy === 0 ? 0 : 1
    const corners = around.length - 1
    let paid = 0
    for (let k = 1; k < corners; k++) {
      const [a, b, c] = [around[k + 1], around[k], around[k - 1]] as [number, number, number]
      const [ux, uy] = [
        (xs[b] as number) - (xs[a] as number),
        (ys[b] as number) - (ys[a] as number),
      ]
      const [vx, vy] = [
        (xs[c] as number) - (xs[b] as number),
        (ys[c] as number) - (ys[b] as number),
      ]
      if (uy === 0 && vy === 0 && ux * vx > 0) {
        paid += count(b, 1)
      } else if (ux === 0 && vx === 0 && uy * vy > 0) {
        paid += count(b, 0)
      }
    }
    const turnsAt = around.filter((at, k) => {
      if (k === 0 || k === corners) {
        return true
      }
      const [a, b, c] = [around[k + 1], at, around[k - 1]] as [number, number, number]
      const straight =
        Math.sign((xs[b] as number) - (xs[a] as number)) ===
          Math.sign((xs[c] as number) - (xs[b] as number)) &&
        Math.sign((ys[b] as number) - (ys[a] as number)) ===
          Math.sign((ys[c] as number) - (ys[b] as number))
      return !straight
    })
    // Here, where the jog back began, where the stretch beside began, and
    // where the path left the line.
    const [here, back0, beside, from] = turnsAt as [number, number, number, number]
    paid += Math.min(count(here, jog), count(back0, jog))
    paid += Math.min(count(beside, jog), count(from, jog))
    // What staying on the line would have cost.
    const slot = hy === 0 ? 1 : 0
    let at = left
    let stay = count(at, slot)
    let walked = 0
    while (at !== node) {
      let step = -1
      for (let e = offsets[at] as number; e < (offsets[at + 1] as number); e++) {
        if (Math.sign(dxOf(e)) === hx && Math.sign(dyOf(e)) === hy && open(e)) {
          step = e
          break
        }
      }
      if (step < 0) {
        return 0
      }
      walked += lengthOf(dxOf(step), dyOf(step))
      if (before(lengths[1] as number, walked)) {
        return 0
      }
      at = targets[step] as number
      stay += count(at, slot)
    }
    return Math.max(stay - paid, 0)
  }

  const relax = (state: number, total: number, turns: number, from: number) => {
    const known = seen[state] === round ? (cost[state] as number) : Number.POSITIVE_INFINITY
    const better =
      known === Number.POSITIVE_INFINITY ||
      (coincident(total, known) ? turns < (bends[state] as number) : total < known)
    if (better) {
      seen[state] = round
      cost[state] = total
      bends[state] = turns
      parent[state] = from
      if (state >= final) {
        queue.push(total, turns, state)
      } else {
        const leg = Math.floor(state / stride)
        queue.push(total + estimate(leg, state - leg * stride), turns, state)
      }
    }
  }

  // The path that arrived in `state` at end `end`, at `total`. Its start is
  // the cheapest of the starts that leave its first node its way, which is
  // the one whose cost it carries.
  const finish = (state: number, end: number, total: number): Path => {
    const nodes = trace(state, parent, sources, targets, stride, edgeOf)
    const first = nodes[0] as number
    const leave = edgeOf[firstState(state, parent) % stride] as number
    const dx = dxOf(leave)
    const dy = dyOf(leave)
    const length = lengthOf(dx, dy)
    let start = -1
    for (const [index, s] of starts.entries()) {
      if (
        s.node === first &&
        matches(s.headings, dx, dy, length) &&
        (start === -1 || before(s.cost, (starts[start] as Resolved).cost))
      ) {
        start = index
      }
    }
    return { nodes, cost: total, start, end }
  }

  for (const start of starts) {
    const leg = passed(0, start.node)
    for (let e = offsets[start.node] as number; e < (offsets[start.node + 1] as number); e++) {
      const dx = dxOf(e)
      const dy = dyOf(e)
      const length = lengthOf(dx, dy)
      if (open(e) && matches(start.headings, dx, dy, length)) {
        relax(leg * stride + (base[e] as number), start.cost + lengthCost(e, length), 0, -1)
      }
    }
  }

  while (queue.size > 0) {
    const state = queue.pop()
    if (done[state] === round) {
      continue
    }
    done[state] = round
    if (state >= final) {
      // A path that has paid for its end, and nothing open costs less.
      return finish(parent[state] as number, state - final, cost[state] as number)
    }
    const leg = Math.floor(state / stride)
    const slot = state - leg * stride
    const e = edgeOf[slot] as number
    const node = targets[e] as number
    const total = cost[state] as number
    const turns = bends[state] as number
    const ax = dxOf(e)
    const ay = dyOf(e)
    const la = lengthOf(ax, ay)
    // Where the run along `e` began, if it began with a turn within the
    // reach, which way that turn went, whether the turn was the second of a
    // jog and so is settled, and otherwise what of it the run has paid so
    // far and what is still owed.
    const way = slot - (base[e] as number)
    const count = (originStart[e + 1] as number) - (originStart[e] as number)
    // A run past the reach that began with a turn where other paths ran
    // straight along it keeps only that, and the way the turn went.
    const sharedEntry = way === 1 || way === 2
    const settled = way > 2 + 2 * count
    const index = way < 3 ? -1 : (way - 3) % (2 * count)
    const origin = index < 0 ? -1 : (originStart[e] as number) + (index >> 1)
    const turnWay = index >= 0 ? index & 1 : way - 1
    const paid = origin < 0 || settled ? 0 : share(originRun[origin] as number)
    const owed = origin < 0 || settled ? 0 : costOfTurn(turnWay) * (1 - paid)
    // The slot of the counts of paths running straight along the run.
    const along = ay === 0 ? 0 : 1

    if (leg < lastLeg && node === via[leg]) {
      // A path that arrives at a waypoint any way but the one it holds
      // ends there.
      if (la > 0 && !alongVia(leg, ax, ay, la)) {
        continue
      }
      relax(passed(leg, node) * stride + slot, total, turns, state)
      continue
    }
    // Off a waypoint that holds the way the path leaves it, the path heads
    // that way.
    const leaving = leg > 0 && via[leg - 1] === node ? viaLeavings[leg - 1] : undefined
    if (leg === lastLeg) {
      // At an end that costs nothing, with nothing owed, the path is done:
      // nothing open costs less. An end with a cost, or a turn still owed,
      // is a step more, and the path goes on too, since another end past it
      // may come out cheaper.
      for (const [end, e] of ends.entries()) {
        if (!arrives(e, node, ax, ay, la)) {
          continue
        }
        if (e.cost === 0 && owed === 0) {
          return finish(state, end, total)
        }
        relax(final + end, total + owed + e.cost, turns, state)
      }
    }

    for (let f = offsets[node] as number; f < (offsets[node + 1] as number); f++) {
      if (!open(f)) {
        continue
      }
      const bx = dxOf(f)
      const by = dyOf(f)
      const lb = lengthOf(bx, by)
      if (leaving !== undefined && !matches(leaving, bx, by, lb)) {
        continue
      }
      // What the step costs beyond its length, how many turns it makes, and
      // the way of the run along `f`: `0` with no turn behind it that
      // matters; `1` or `2` for a turn past the reach where other paths ran
      // straight along the run, by its way; else three more than twice its
      // origin's index, plus one for a counterclockwise turn there, and
      // twice the count of origins more for a turn that is settled.
      let extra = 0
      let turned = 0
      let next = 0
      const first = originStart[f] as number
      const last = originStart[f + 1] as number
      if (la > 0 && lb > 0) {
        const cross = ax * by - ay * bx
        if (Math.abs(cross) > RELATIVE_TOLERANCE * la * lb) {
          const turning = cross > 0 ? 0 : 1
          turned = 1
          // Whether the path came onto the run from one side and leaves it
          // to the other, in which case it crosses the paths that run
          // straight along the run at both of its ends.
          const across = (origin >= 0 || sharedEntry) && turning !== turnWay
          if (across && through !== undefined) {
            const atEnd = through[2 * node + along] ?? 0
            extra +=
              crossingCost *
              (origin >= 0
                ? Math.min(through[2 * (originNode[origin] as number) + along] ?? 0, atEnd)
                : Math.min(1, atEnd))
          }
          // Whether other paths run straight along the run from here.
          const shared = through !== undefined && (through[2 * node + (by === 0 ? 0 : 1)] ?? 0) > 0
          if (across && origin >= 0 && !settled) {
            // The second turn of a jog pays what the first has paid, and
            // the first owes nothing more. The run from here is settled,
            // with where it began kept for the crossings it may make, as
            // long as crossings count.
            extra += costOfTurn(turning) * paid
            if (through !== undefined) {
              next = last > first ? 3 + 2 * (last - first) + turning : shared ? 1 + turning : 0
              extra += crossingCost * dodged(state, node, Math.sign(bx), Math.sign(by))
            }
          } else {
            extra += owed
            if (last > first) {
              // The first turn onto a run within the reach pays by the
              // run's first half-edge, and the rest as the run grows.
              next = 3 + turning
              extra += costOfTurn(turning) * share(originRun[first] as number)
            } else {
              extra += costOfTurn(turning)
              if (shared) {
                next = 1 + turning
              }
            }
          }
        } else if (ax * bx + ay * by < 0) {
          continue
        } else {
          // Straight on, across the paths that run through the other way.
          if (through !== undefined) {
            extra += crossingCost * (through[2 * node + (ay === 0 ? 1 : 0)] ?? 0)
          }
          if (sharedEntry) {
            next = way
          } else if (origin >= 0) {
            // Straight on along the run: the turn onto it is paid by the
            // run's growth, or paid off once the run is past the reach,
            // where a settled turn pays nothing more, and the run keeps
            // only whether other paths ran straight along it where it
            // began.
            const from = originNode[origin] as number
            let found = -1
            for (let k = first; k < last; k++) {
              if (originNode[k] === from) {
                found = k
                break
              }
            }
            if (found < 0) {
              extra += owed
              if (through !== undefined && (through[2 * from + along] ?? 0) > 0) {
                next = 1 + turnWay
              }
            } else if (settled) {
              next = 3 + 2 * (last - first) + 2 * (found - first) + turnWay
            } else {
              next = 3 + 2 * (found - first) + turnWay
              extra += costOfTurn(turnWay) * (share(originRun[found] as number) - paid)
            }
          }
        }
      } else {
        // Across an edge of no length a turn is free, and the run's first
        // turn is paid off.
        extra += owed
      }
      relax(
        leg * stride + (base[f] as number) + next,
        total + lengthCost(f, lb) + extra,
        turns + turned,
        state,
      )
    }
  }
  return undefined
}

/**
 * Finds the paths of several routes on one graph, each among the others so
 * that it crosses as few of them as it can afford: first among the paths
 * found before it, then once more in each later round, for each path that
 * crosses another, or that `again` asks for, among all the others' latest
 * paths.
 *
 * @param graph - The graph the paths run on, with horizontal and vertical
 * edges.
 * @param count - How many routes there are.
 * @param crossingCost - The cost of each crossing. With none, crossings
 * leave the paths as they are.
 * @param find - Finds route `k`'s path, given how many other paths run
 * straight on through each node (see `SearchOptions.through`) and the
 * round: `0` the first, among the paths found before it, and `1` on among
 * all the others.
 * @param again - Whether route `k`'s path is found once more in each later
 * round anyway, such as when it depends on the others' paths. None are by
 * default.
 * @param rounds - How many rounds follow the first. One by default.
 * @returns Each route's path, or `undefined` where it has none, and how
 * many of them run straight on through each node, or `undefined` with no
 * crossing cost.
 */
export function searchAll(
  graph: Graph,
  count: number,
  crossingCost: number,
  find: (k: number, through: ArrayLike<number> | undefined, round: number) => Path | undefined,
  again: (k: number) => boolean = () => false,
  rounds = 1,
): { paths: Array<Path | undefined>; through: Int32Array | undefined } {
  const crossing = crossingCost > 0 && graph.orthogonal
  const through = crossing ? new Int32Array(2 * graph.xs.length) : undefined
  const paths: Array<Path | undefined> = []
  for (let k = 0; k < count; k++) {
    const path = find(k, through, 0)
    if (through !== undefined) {
      markThrough(graph, through, path, 1)
    }
    paths.push(path)
  }
  // A path that crosses none of the others keeps its place.
  for (let round = 1; round <= rounds; round++) {
    for (let k = 0; k < count; k++) {
      if (through === undefined) {
        if (again(k)) {
          paths[k] = find(k, undefined, round)
        }
        continue
      }
      markThrough(graph, through, paths[k], -1)
      if (again(k) || crossesThrough(graph, through, paths[k])) {
        paths[k] = find(k, through, round)
      }
      markThrough(graph, through, paths[k], 1)
    }
  }
  return { paths, through }
}

/**
 * Marks the half-edges a path runs along, or their twins, which run back
 * the other way (see `SearchOptions.partners`).
 *
 * @param graph - The graph the path runs on.
 * @param marks - The marks, by half-edge, which this sets to `1`.
 * @param path - The path, or `undefined` for none.
 * @param back - Whether to mark the twins.
 * @param keep - Whether to mark each half-edge, all by default.
 */
export function markAlong(
  graph: Graph,
  marks: Uint8Array,
  path: Path | undefined,
  back: boolean,
  keep: (e: number) => boolean = () => true,
): void {
  const { offsets, targets } = graph
  const nodes = path?.nodes ?? []
  for (let k = 1; k < nodes.length; k++) {
    const [from, to] = back
      ? [nodes[k] as number, nodes[k - 1] as number]
      : [nodes[k - 1] as number, nodes[k] as number]
    for (let e = offsets[from] as number; e < (offsets[from + 1] as number); e++) {
      if (targets[e] === to && keep(e)) {
        marks[e] = 1
      }
    }
  }
}

/**
 * Counts a path into, or out of, how many paths run straight on through
 * each node (see `SearchOptions.through`). A path counts at its ends too,
 * along the way it leaves or arrives, as if it ran on through them: what
 * it leads to there, a port or a lane's whisk, goes on that way, so a path
 * that runs straight across an end crosses it.
 *
 * @param graph - The graph the path runs on.
 * @param through - The counts, at `2 * node` horizontally and
 * `2 * node + 1` vertically, which this updates.
 * @param path - The path, or `undefined` for none.
 * @param by - `1` to count the path in, `-1` to count it out.
 */
export function markThrough(
  graph: Graph,
  through: Int32Array,
  path: Path | undefined,
  by: number,
): void {
  const add = (slot: number) => {
    const count = through[slot] as number
    through[slot] = count + by
  }
  straightOn(graph, path, add)
  endsOn(graph, path, add)
}

// Whether a path runs straight on across any of the paths counted in
// `through`.
function crossesThrough(graph: Graph, through: Int32Array, path: Path | undefined): boolean {
  let crossed = false
  straightOn(graph, path, (_, across) => {
    crossed ||= (through[across] as number) > 0
  })
  return crossed
}

// Calls `visit` with the slots in `through` of each node that a path runs
// straight on through: its own axis there, and the other.
function straightOn(
  graph: Graph,
  path: Path | undefined,
  visit: (slot: number, across: number) => void,
): void {
  const { xs, ys } = graph
  const nodes = path?.nodes ?? []
  for (let k = 1; k + 1 < nodes.length; k++) {
    const [a, b, c] = [nodes[k - 1] as number, nodes[k] as number, nodes[k + 1] as number]
    const [x, y] = [xs[b] as number, ys[b] as number]
    const [ux, uy, vx, vy] = [
      x - (xs[a] as number),
      y - (ys[a] as number),
      (xs[c] as number) - x,
      (ys[c] as number) - y,
    ]
    if (uy === 0 && vy === 0 && ux * vx > 0) {
      visit(2 * b, 2 * b + 1)
    } else if (ux === 0 && vx === 0 && uy * vy > 0) {
      visit(2 * b + 1, 2 * b)
    }
  }
}

// Calls `visit` with the slot in `through` of each end of a path on the
// axis it leaves or arrives along, as if it ran straight on through: what
// it leads to past its end, a port or a lane's whisk, goes on that way.
function endsOn(graph: Graph, path: Path | undefined, visit: (slot: number) => void): void {
  const { xs, ys } = graph
  const nodes = path?.nodes ?? []
  if (nodes.length < 2) {
    return
  }
  for (const [end, next] of [
    [nodes[0], nodes[1]],
    [nodes.at(-1), nodes.at(-2)],
  ] as Array<[number, number]>) {
    const dx = (xs[next] as number) - (xs[end] as number)
    const dy = (ys[next] as number) - (ys[end] as number)
    if (dy === 0 && dx !== 0) {
      visit(2 * end)
    } else if (dx === 0 && dy !== 0) {
      visit(2 * end + 1)
    }
  }
}

// The state of a search, kept with its graph for the next search on it.
// A state's cost, turns, and parent count only when `seen` holds the
// current round, and it is closed when `done` does.
interface Scratch {
  readonly cost: Float64Array
  readonly bends: Int32Array
  readonly parent: Int32Array
  readonly seen: Uint32Array
  readonly done: Uint32Array
  readonly queue: Queue
  round: number
}

const scratches = new WeakMap<Graph, Scratch>()
const spans = new WeakMap<Graph, { dxs: Float64Array; dys: Float64Array }>()
const layouts = new WeakMap<Graph, Map<number, Layout>>()

// The states of one leg of a search on a graph with a corner radius, kept
// with the graph for the next search with that radius. Each half-edge has
// a state for a path whose run began nowhere that matters, two for a run
// past the reach that began with a turn where other paths ran straight
// along it, one per way the turn went, and four more for each node within
// the reach behind it that a run through it could have begun at with a
// turn: one per way the turn went, for a turn still being paid for, and
// one per way for a turn that is settled, the second of a jog, kept only
// for the crossings the run may make.
interface Layout {
  // How many states a leg has.
  readonly stride: number
  // The first state of each half-edge, and one past the last half-edge's.
  readonly base: Int32Array
  // The half-edge of each state.
  readonly edgeOf: Int32Array
  // The first of each half-edge's origins, and one past the last
  // half-edge's. A half-edge shorter than the reach has its own source first.
  readonly originStart: Int32Array
  // The node of each origin, and how long a run from it through the
  // half-edge is.
  readonly originNode: Int32Array
  readonly originRun: Float64Array
}

// The layout of the states of a search on `graph` with corners of `radius`.
// With no radius, or on a graph with edges that run any way, a half-edge
// has one state.
function layoutFor(graph: Graph, radius: number): Layout {
  let found = layouts.get(graph)
  if (found === undefined) {
    found = new Map()
    layouts.set(graph, found)
  }
  let layout = found.get(radius)
  if (layout === undefined) {
    layout = layOut(graph, radius)
    found.set(radius, layout)
  }
  return layout
}

function layOut(graph: Graph, radius: number): Layout {
  const { xs, ys, offsets, sources, targets } = graph
  const { dxs, dys } = spansOf(graph)
  const edgeCount = targets.length
  const reach = 2 * radius
  const originStart = new Int32Array(edgeCount + 1)
  const nodes: Array<number> = []
  const runs: Array<number> = []
  for (let e = 0; e < edgeCount; e++) {
    const hx = Math.sign(dxs[e] as number)
    const hy = Math.sign(dys[e] as number)
    if (graph.orthogonal && reach > 0 && (hx !== 0 || hy !== 0)) {
      // The nodes back along the line of `e` from its source, within the
      // reach of its target, nearest first.
      const to = targets[e] as number
      const behind = [sources[e] as number]
      for (let i = 0; i < behind.length; i++) {
        const from = behind[i] as number
        const run =
          Math.abs((xs[from] as number) - (xs[to] as number)) +
          Math.abs((ys[from] as number) - (ys[to] as number))
        if (run >= reach) {
          continue
        }
        nodes.push(from)
        runs.push(run)
        for (let g = offsets[from] as number; g < (offsets[from + 1] as number); g++) {
          const back = targets[g] as number
          if (
            Math.sign(dxs[g] as number) === -hx &&
            Math.sign(dys[g] as number) === -hy &&
            !behind.includes(back)
          ) {
            behind.push(back)
          }
        }
      }
    }
    originStart[e + 1] = nodes.length
  }
  const base = new Int32Array(edgeCount + 1)
  for (let e = 0; e < edgeCount; e++) {
    const origins = (originStart[e + 1] as number) - (originStart[e] as number)
    base[e + 1] = (base[e] as number) + 3 + 4 * origins
  }
  const stride = base[edgeCount] as number
  const edgeOf = new Int32Array(stride)
  for (let e = 0; e < edgeCount; e++) {
    edgeOf.fill(e, base[e] as number, base[e + 1] as number)
  }
  return {
    stride,
    base,
    edgeOf,
    originStart,
    originNode: Int32Array.from(nodes),
    originRun: Float64Array.from(runs),
  }
}

// The axis distances that each half-edge of `graph` spans, kept with the
// graph for the next search on it.
function spansOf(graph: Graph): { dxs: Float64Array; dys: Float64Array } {
  let found = spans.get(graph)
  if (found === undefined) {
    const { xs, ys, sources, targets } = graph
    const dxs = new Float64Array(targets.length)
    const dys = new Float64Array(targets.length)
    for (let e = 0; e < targets.length; e++) {
      dxs[e] = (xs[targets[e] as number] as number) - (xs[sources[e] as number] as number)
      dys[e] = (ys[targets[e] as number] as number) - (ys[sources[e] as number] as number)
    }
    found = { dxs, dys }
    spans.set(graph, found)
  }
  return found
}

// The scratch state of a search on `graph` with `size` states, for a new
// round.
function scratchFor(graph: Graph, size: number): Scratch {
  let scratch = scratches.get(graph)
  if (scratch === undefined || scratch.seen.length < size || scratch.round === 0xffffffff) {
    scratch = {
      cost: new Float64Array(size),
      bends: new Int32Array(size),
      parent: new Int32Array(size),
      seen: new Uint32Array(size),
      done: new Uint32Array(size),
      queue: scratch?.queue ?? new Queue(),
      round: 0,
    }
    scratches.set(graph, scratch)
  }
  scratch.round++
  return scratch
}

interface Resolved {
  readonly node: number
  readonly headings: Array<Direction> | undefined
  readonly cost: number
}

const endpoints = (value: number | ReadonlyArray<Endpoint>): Array<Resolved> =>
  typeof value === 'number'
    ? [{ node: value, headings: undefined, cost: 0 }]
    : value.map(({ node, headings: list, cost }) => ({
        node,
        headings: headings(list),
        cost: positiveLength(cost),
      }))

// The state a path starts with: the first of its chain of parents.
function firstState(state: number, parent: Int32Array): number {
  let current = state
  while ((parent[current] as number) !== -1) {
    current = parent[current] as number
  }
  return current
}

// The length of a vector, exact when it is horizontal or vertical.
const lengthOf = (dx: number, dy: number) =>
  dx === 0 ? Math.abs(dy) : dy === 0 ? Math.abs(dx) : Math.hypot(dx, dy)

// The way a path heading along (hx, hy) was heading before a turn of `way`
// onto it, clockwise (`0`) or counterclockwise (`1`).
const cameFrom = (way: number, hx: number, hy: number): [number, number] =>
  way === 0 ? [hy, -hx] : [-hy, hx]

interface Direction extends PointLike {
  readonly length: number
}

// The headings with their lengths, or `undefined` for any heading. Headings
// without a direction are dropped.
function headings(list: ReadonlyArray<PointLike> | undefined): Array<Direction> | undefined {
  if (list === undefined) {
    return undefined
  }
  const result: Array<Direction> = []
  for (const { x, y } of list) {
    const length = lengthOf(x, y)
    if (length > 0 && Number.isFinite(length)) {
      result.push({ x, y, length })
    }
  }
  return result
}

// Whether a vector of the given length points along one of the headings.
const matches = (
  list: ReadonlyArray<Direction> | undefined,
  x: number,
  y: number,
  length: number,
) =>
  list === undefined ||
  (length > 0 &&
    list.some(
      (h) =>
        Math.abs(h.x * y - h.y * x) <= RELATIVE_TOLERANCE * h.length * length &&
        h.x * x + h.y * y > 0,
    ))

// Whether the segment from (x1, y1) to (x2, y2) crosses the interior of the
// rect. The segment is clipped to the closed rect (Liang and Barsky), and the
// middle of what is left lies strictly inside unless the segment only runs
// along an edge or touches a corner.
function crosses(r: Obstacle, x1: number, y1: number, x2: number, y2: number): boolean {
  const dx = x2 - x1
  const dy = y2 - y1
  let t0 = 0
  let t1 = 1
  const clip = (p: number, q: number) => {
    if (p === 0) {
      return q >= 0
    }
    const t = q / p
    if (p < 0) {
      if (t > t1) {
        return false
      }
      t0 = Math.max(t0, t)
    } else {
      if (t < t0) {
        return false
      }
      t1 = Math.min(t1, t)
    }
    return true
  }
  if (!(clip(-dx, x1 - r.left) && clip(dx, r.right - x1))) {
    return false
  }
  if (!(clip(-dy, y1 - r.top) && clip(dy, r.bottom - y1))) {
    return false
  }
  const t = (t0 + t1) / 2
  const x = x1 + dx * t
  const y = y1 + dy * t
  return before(r.left, x) && before(x, r.right) && before(r.top, y) && before(y, r.bottom)
}

// The nodes of the path that ends in `state`. A state whose parent arrived
// along the same half-edge moved to the next leg there, and adds no node.
function trace(
  state: number,
  parent: Int32Array,
  sources: Int32Array,
  targets: Int32Array,
  stride: number,
  edgeOf: Int32Array,
): Int32Array {
  const nodes: Array<number> = []
  let current = state
  let first = state
  while (current !== -1) {
    const previous = parent[current] as number
    if (previous === -1 || edgeOf[previous % stride] !== edgeOf[current % stride]) {
      nodes.push(targets[edgeOf[current % stride] as number] as number)
    }
    first = current
    current = previous
  }
  nodes.push(sources[edgeOf[first % stride] as number] as number)
  return Int32Array.from(nodes.toReversed())
}

// Whether an entry with priority `priority`, `turns` turns, and push order
// `order` pops before one with `p`, `t`, and `o`.
function precedes(
  priority: number,
  turns: number,
  order: number,
  p: number,
  t: number,
  o: number,
): boolean {
  if (!coincident(priority, p)) {
    return priority < p
  }
  return turns === t ? order < o : turns < t
}

// A binary heap of states by priority, then by turns. Priorities within
// rounding distance pop with fewer turns first, then in the order they were
// pushed. Its entries live in typed arrays that grow as needed and are kept
// from one search to the next.
class Queue {
  #priorities = new Float64Array(64)
  #turns = new Int32Array(64)
  #states = new Int32Array(64)
  #order = new Float64Array(64)
  #size = 0
  #pushed = 0

  get size(): number {
    return this.#size
  }

  clear(): void {
    this.#size = 0
    this.#pushed = 0
  }

  push(priority: number, turns: number, state: number): void {
    if (this.#size === this.#states.length) {
      this.#grow()
    }
    const order = this.#pushed++
    // Moves the parents down past the new entry, then puts it in the hole.
    let i = this.#size++
    while (i > 0) {
      const up = (i - 1) >> 1
      if (!this.#precedes(priority, turns, order, up)) {
        break
      }
      this.#move(up, i)
      i = up
    }
    this.#put(i, priority, turns, state, order)
  }

  pop(): number {
    const top = this.#states[0] as number
    const last = --this.#size
    const priority = this.#priorities[last] as number
    const turns = this.#turns[last] as number
    const state = this.#states[last] as number
    const order = this.#order[last] as number
    // Moves the smaller children up past the last entry, then puts it in
    // the hole.
    let i = 0
    for (;;) {
      const left = 2 * i + 1
      if (left >= last) {
        break
      }
      const right = left + 1
      const child =
        right < last &&
        this.#precedes(
          this.#priorities[right] as number,
          this.#turns[right] as number,
          this.#order[right] as number,
          left,
        )
          ? right
          : left
      if (
        !precedes(
          this.#priorities[child] as number,
          this.#turns[child] as number,
          this.#order[child] as number,
          priority,
          turns,
          order,
        )
      ) {
        break
      }
      this.#move(child, i)
      i = child
    }
    if (last > 0) {
      this.#put(i, priority, turns, state, order)
    }
    return top
  }

  // Whether an entry pops before the one at `at`.
  #precedes(priority: number, turns: number, order: number, at: number): boolean {
    return precedes(
      priority,
      turns,
      order,
      this.#priorities[at] as number,
      this.#turns[at] as number,
      this.#order[at] as number,
    )
  }

  #move(from: number, to: number): void {
    this.#priorities[to] = this.#priorities[from] as number
    this.#turns[to] = this.#turns[from] as number
    this.#states[to] = this.#states[from] as number
    this.#order[to] = this.#order[from] as number
  }

  #put(at: number, priority: number, turns: number, state: number, order: number): void {
    this.#priorities[at] = priority
    this.#turns[at] = turns
    this.#states[at] = state
    this.#order[at] = order
  }

  #grow(): void {
    const size = 2 * this.#states.length
    const grown = <T extends Float64Array | Int32Array>(list: T, make: (n: number) => T): T => {
      const next = make(size)
      next.set(list)
      return next
    }
    this.#priorities = grown(this.#priorities, (n) => new Float64Array(n))
    this.#turns = grown(this.#turns, (n) => new Int32Array(n))
    this.#states = grown(this.#states, (n) => new Int32Array(n))
    this.#order = grown(this.#order, (n) => new Float64Array(n))
  }
}
