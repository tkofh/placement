import { EPSILON, RELATIVE_TOLERANCE, coincident } from 'curvy/number'

// One-dimensional placement with separation constraints (Dwyer, Marriott,
// and Stuckey, "Fast Node Overlap Removal", 2006, the solver known as VPSC).
// Each variable wants to sit at a desired position, and each constraint keeps
// a right variable at least a gap past a left one. The solver finds the
// positions that minimize the weighted sum of squared distances from the
// desired positions:
//
//   minimize sum(weight * (position - desired)^2)
//   subject to position(right) - position(left) >= gap
//
// It is an active set method. Variables joined by constraints that hold at
// exactly their gap form a block that moves as one, to the weighted mean of
// its members' desired positions. Visiting the variables left to right, the
// solver merges into each one's block the block behind its most violated
// incoming constraint. Then it splits a block across the constraint with the
// most negative Lagrange multiplier, the constraint that holds its two sides
// together against their will, and merges again, until no multiplier is
// negative.
//
// A fixed variable stays at its desired position. It acts as a variable of
// infinite weight, so gradients and multipliers have two parts, compared in
// order: the pull of fixed variables, then the pull of free ones. A block
// sits at the mean of where its fixed members put it. When those disagree
// and no split can free them, the constraints between them cannot all hold,
// and the solver reports the block as a conflict, which the caller can
// relax.

export interface Variable {
  readonly desired: number
  // Defaults to `1`.
  readonly weight?: number
  readonly fixed?: boolean
}

export interface Separation {
  readonly left: number
  readonly right: number
  readonly gap: number
}

export interface Conflict {
  // The variables of a block whose fixed members disagree, or whose
  // constraints could not all hold.
  readonly variables: ReadonlyArray<number>
}

export interface Placement {
  readonly positions: Float64Array
  readonly conflicts: ReadonlyArray<Conflict>
}

interface Block {
  readonly variables: Array<number>
  readonly active: Array<number>
  // Sums of desired - offset over fixed members, and of weight * (desired -
  // offset) and weight over free ones.
  fixedSum: number
  fixedCount: number
  sum: number
  weight: number
}

// Where a block's offsets start: the mean of where its fixed members put it,
// or the weighted mean of its free members' wishes.
function originOf(block: Block): number {
  return block.fixedCount > 0 ? block.fixedSum / block.fixedCount : block.sum / block.weight
}

function emptyBlock(): Block {
  return { variables: [], active: [], fixedSum: 0, fixedCount: 0, sum: 0, weight: 0 }
}

/**
 * Places variables as close to their desired positions as the separation
 * constraints allow.
 *
 * @param variables - The variables, each with its desired position.
 * @param constraints - The separations between pairs of variables. The
 * constraints must not form a cycle.
 * @returns The position of each variable, and the blocks whose constraints
 * could not all hold between fixed variables. Fixed variables always sit at
 * their desired positions.
 */
export function placeSeparated(
  variables: ReadonlyArray<Variable>,
  constraints: ReadonlyArray<Separation>,
): Placement {
  const count = variables.length
  const desired = Float64Array.from(variables, (v) => v.desired)
  const weights = Float64Array.from(variables, (v) => ((v.weight ?? 1) > 0 ? (v.weight ?? 1) : 1))
  const fixed = Uint8Array.from(variables, (v) => (v.fixed === true ? 1 : 0))
  const offsets = new Float64Array(count)
  const owner = new Int32Array(count)
  const blocks: Array<Block | undefined> = []

  const recompute = (block: Block) => {
    block.fixedSum = 0
    block.fixedCount = 0
    block.sum = 0
    block.weight = 0
    for (const v of block.variables) {
      const at = (desired[v] as number) - (offsets[v] as number)
      if (fixed[v] === 1) {
        block.fixedSum += at
        block.fixedCount++
      } else {
        block.sum += (weights[v] as number) * at
        block.weight += weights[v] as number
      }
    }
  }
  for (let v = 0; v < count; v++) {
    owner[v] = v
    const block = emptyBlock()
    block.variables.push(v)
    recompute(block)
    blocks.push(block)
  }

  let scale = 0
  let freeWeight = 0
  for (let v = 0; v < count; v++) {
    scale = Math.max(scale, Math.abs(desired[v] as number))
    if (fixed[v] === 0) {
      freeWeight += weights[v] as number
    }
  }
  // Pulls within rounding of zero, for the scale of the problem: of fixed
  // variables, in units of distance, and of free ones, weighted.
  const band = EPSILON + RELATIVE_TOLERANCE * scale
  const fixedTolerance = band * Math.max(count, 1)
  const freeTolerance = band * Math.max(freeWeight, 1)

  const blockOf = (v: number) => blocks[owner[v] as number] as Block
  const position = (v: number) =>
    fixed[v] === 1 && blockOf(v).fixedCount === 1
      ? (desired[v] as number)
      : originOf(blockOf(v)) + (offsets[v] as number)

  // Joins the blocks of a constraint's two sides, so that it holds at
  // exactly its gap. The larger block keeps its offsets.
  const merge = (c: number) => {
    const { left, right, gap } = constraints[c] as Separation
    const a = owner[left] as number
    const b = owner[right] as number
    const keep = (blocks[a] as Block).variables.length >= (blocks[b] as Block).variables.length
    const [base, other] = keep ? [a, b] : [b, a]
    // How far the other block's offsets move into the base block's frame.
    const shift = keep
      ? (offsets[left] as number) + gap - (offsets[right] as number)
      : (offsets[right] as number) - gap - (offsets[left] as number)
    const into = blocks[base] as Block
    const from = blocks[other] as Block
    for (const v of from.variables) {
      const offset = offsets[v] as number
      offsets[v] = offset + shift
      owner[v] = base
      into.variables.push(v)
    }
    into.active.push(...from.active, c)
    blocks[other] = undefined
    recompute(into)
  }

  // The multiplier of each active constraint in a block, as its pull from
  // fixed variables and from free ones: how much the cost would fall per
  // unit of separation past its gap. The active constraints form a tree.
  // Each fixed member absorbs whatever free pull its subtree has, as a
  // variable of infinite weight would.
  const multipliers = (block: Block, out: Map<number, [number, number]>) => {
    const incident = new Map<number, Array<number>>()
    for (const c of block.active) {
      const { left, right } = constraints[c] as Separation
      for (const v of [left, right]) {
        const list = incident.get(v)
        if (list === undefined) {
          incident.set(v, [c])
        } else {
          list.push(c)
        }
      }
    }
    const root = block.variables.find((v) => fixed[v] === 1) ?? (block.variables[0] as number)
    // Depth-first from the root, so that children follow their parents.
    const order: Array<[variable: number, via: number]> = []
    const stack: Array<[number, number]> = [[root, -1]]
    while (stack.length > 0) {
      const [v, via] = stack.pop() as [number, number]
      order.push([v, via])
      for (const c of incident.get(v) ?? []) {
        if (c !== via) {
          const { left, right } = constraints[c] as Separation
          stack.push([left === v ? right : left, c])
        }
      }
    }
    const pull = new Map<number, [number, number]>()
    const at = originOf(block)
    for (const [v] of order) {
      const away = at + (offsets[v] as number) - (desired[v] as number)
      pull.set(v, fixed[v] === 1 ? [away, 0] : [0, (weights[v] as number) * away])
    }
    for (let k = order.length - 1; k > 0; k--) {
      const [v, via] = order[k] as [number, number]
      const total = pull.get(v) as [number, number]
      if (fixed[v] === 1) {
        total[1] = 0
      }
      const { left, right } = constraints[via] as Separation
      // The subtree hangs off the constraint's right side or its left.
      out.set(via, left === v ? [-total[0], -total[1]] : [total[0], total[1]])
      const parent = pull.get(left === v ? right : left) as [number, number]
      parent[0] += total[0]
      parent[1] += total[1]
    }
  }

  // Splits the block across the active constraint with the most negative
  // multiplier, if any is negative.
  const split = () => {
    const lambdas = new Map<number, [number, number]>()
    for (const block of blocks) {
      if (block !== undefined && block.active.length > 0) {
        multipliers(block, lambdas)
      }
    }
    let worst = -1
    let lowest: [number, number] = [0, 0]
    for (const [c, lambda] of lambdas) {
      const negative =
        lambda[0] < -fixedTolerance || (lambda[0] <= fixedTolerance && lambda[1] < -freeTolerance)
      if (!negative) {
        continue
      }
      const lower =
        worst === -1 ||
        lambda[0] < lowest[0] - fixedTolerance ||
        (lambda[0] <= lowest[0] + fixedTolerance && lambda[1] < lowest[1])
      if (lower) {
        worst = c
        lowest = lambda
      }
    }
    if (worst === -1) {
      return false
    }
    const { left } = constraints[worst] as Separation
    const index = owner[left] as number
    const block = blocks[index] as Block
    const active = block.active.filter((c) => c !== worst)
    // The left side keeps what it reaches without `worst`.
    const reached = new Set<number>([left])
    const queue = [left]
    while (queue.length > 0) {
      const v = queue.pop() as number
      for (const c of active) {
        const { left: l, right: r } = constraints[c] as Separation
        const other = l === v ? r : r === v ? l : -1
        if (other !== -1 && !reached.has(other)) {
          reached.add(other)
          queue.push(other)
        }
      }
    }
    const leftBlock = emptyBlock()
    const rightBlock = emptyBlock()
    for (const v of block.variables) {
      ;(reached.has(v) ? leftBlock : rightBlock).variables.push(v)
    }
    for (const c of active) {
      ;(reached.has((constraints[c] as Separation).left) ? leftBlock : rightBlock).active.push(c)
    }
    recompute(leftBlock)
    recompute(rightBlock)
    blocks[index] = leftBlock
    blocks.push(rightBlock)
    for (const v of rightBlock.variables) {
      owner[v] = blocks.length - 1
    }
    return true
  }

  const violated = (c: number) => {
    const { left, right, gap } = constraints[c] as Separation
    const want = position(left) + gap
    const at = position(right)
    return at < want && !coincident(at, want)
  }

  // The constraints into each variable, and an order of the variables in
  // which every constraint's left side comes before its right side.
  const incoming: Array<Array<number>> = Array.from({ length: count }, () => [])
  const outgoing: Array<Array<number>> = Array.from({ length: count }, () => [])
  const pending = new Int32Array(count)
  for (const [c, { left, right }] of constraints.entries()) {
    ;(incoming[right] as Array<number>).push(c)
    ;(outgoing[left] as Array<number>).push(c)
    const waiting = pending[right] as number
    pending[right] = waiting + 1
  }
  const order: Array<number> = []
  for (let v = 0; v < count; v++) {
    if (pending[v] === 0) {
      order.push(v)
    }
  }
  for (let k = 0; k < order.length; k++) {
    for (const c of outgoing[order[k] as number] as Array<number>) {
      const right = (constraints[c] as Separation).right
      const waiting = (pending[right] as number) - 1
      pending[right] = waiting
      if (waiting === 0) {
        order.push(right)
      }
    }
  }

  // Visits the variables left to right, and merges into each one's block
  // the block behind its most violated incoming constraint, until none is.
  const satisfy = () => {
    for (const v of order) {
      for (;;) {
        const block = blockOf(v)
        let worst = -1
        let lowest = 0
        for (const u of block.variables) {
          for (const c of incoming[u] as Array<number>) {
            const { left, right, gap } = constraints[c] as Separation
            if (owner[left] === owner[u] || !violated(c)) {
              continue
            }
            const slack = position(right) - position(left) - gap
            if (worst === -1 || slack < lowest) {
              worst = c
              lowest = slack
            }
          }
        }
        if (worst === -1) {
          break
        }
        merge(worst)
      }
    }
  }

  satisfy()
  const limit = 10 * (count + constraints.length) + 100
  for (let step = 0; step < limit && split(); step++) {
    satisfy()
  }

  const conflicts: Array<Conflict> = []
  const reported = new Set<Block>()
  for (const block of blocks) {
    if (block === undefined || block.fixedCount < 2) {
      continue
    }
    const at = originOf(block)
    const disagree = block.variables.some(
      (v) => fixed[v] === 1 && !coincident(at + (offsets[v] as number), desired[v] as number),
    )
    if (disagree) {
      reported.add(block)
      conflicts.push({ variables: [...block.variables] })
    }
  }
  for (let c = 0; c < constraints.length; c++) {
    if (violated(c)) {
      const { left, right } = constraints[c] as Separation
      const a = blockOf(left)
      const b = blockOf(right)
      if (!reported.has(a) || !reported.has(b)) {
        reported.add(a)
        reported.add(b)
        conflicts.push({ variables: [...new Set([...a.variables, ...b.variables])] })
      }
    }
  }

  const positions = new Float64Array(count)
  for (let v = 0; v < count; v++) {
    positions[v] = fixed[v] === 1 ? (desired[v] as number) : position(v)
  }
  return { positions, conflicts }
}
