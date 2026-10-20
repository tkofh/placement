# Merge v2: lanes the nudge places

Status: design draft for Tim, 2026-10-19. Not started.

## What is wrong with merges today

`planMerges` (merge.ts) decides a merge's geometry before any route exists:

- **Lanes are pins.** Each merged end's port moves out to its lane end:
  `reach` from the side, at a fixed lateral offset, a merge gap from the
  next. The nudge holds every route's end segment on its pin, so a lane can
  never move.
- **Lane order is set before routing.** Spread orders the ends, and the
  search may only trade neighbouring lanes of equal stroke.
- **Each lane adds a line to the visibility graph.** Lane ends sit a merge
  gap apart, closer than the gap, so no route fits between them. Other
  routes still ride those lines, and they land within a pixel of lines from
  nearby rects.
- **Zones are hard obstacles that stick out past the clearance**, by
  `reach - clearance` (2.74 px at db's left in the playground scene). Lane
  ends sit on the zone's outer face.

What each one costs, in Tim's problem cases:

| Mechanism | Symptom | Cases |
|---|---|---|
| Fixed lane offsets | auth->db's lane (385.75) sits below where auth's clearance lets it run (<= 378.34), so it steps down, and billing->db steps with it | 2 |
| Lane lines | mailer rides the bundle's lanes and gets pinched; patched by the pinch rule, which marks them | 2, 3, 4 |
| Zone face plus lane-end lines | the search runs down three vertical lines within 3 px (event bus's lane ends 766.11, db's zone face 765.26, db's clearance edge 768) and hops between them for under a pixel each. The nudge places each piece on its own and pushes the middle one, which crosses the bundle, a gap clear of the zone: the bracket | 1, and 3 and 4 after the pinch rule |
| Lines a pixel apart | small moves of a rect reorder near-ties; mailer and indexer change at almost every threshold of the auth sweep | all |

## What we want

Tim's sketch: a bundle converges onto the port's line near the port and
shares it there, under the shared adornments. Its members fan out to the
merge gap where there is room, lie on top of each other where there is
none, and peel off with corners. Other routes cross a bundle where its
members run straight, clear of the fan.

## The model

A merge has three parts, from the port out:

- **Trunk**: the port's line from the port to the *branch*, the distance
  `B` from the side where the fan ends. The shared adornments pack onto it.
  Every member lies on it, on top of the others. It is held.
- **Fan**: each member steps off the trunk to its lane, with today's
  `step()` arcs. All the arcs on one side of the line have one radius and
  meet the line on one circle, so they peel off one another and never cross.
  The fan sits between the pack and `B`, as today.
- **Lanes**: each member's run past `B`, parallel to the others. Their
  offsets and their order are **nudge variables**, no longer pins.

### Search

- `planMerges` keeps computing `B` (today's `reach`: the pack plus the
  outermost step, at most half the free room in front) and the zone. It no
  longer moves each end to its own lane pin.
- Every member of a merge routes to **one shared branch pin**, on the port's
  line at `B`, arriving along that line. That is one line where there were
  `n`. The cramped case, with no room past the pack, routes to the port as
  today.
- **Merged sides get a deeper clearance, with zones as the fallback.** Where
  a merge's reach is deeper than the clearance, the rect's own grown box
  moves out on that side to the deepest reach of any merge there, corners
  included. It replaces the box at the same index in the blocks, so notes
  still name the rect. The whisks then always fall inside the rect's own
  box, whatever lanes the nudge picks. A route along that side meets one
  face and runs straight along it: no zone face 2.74 px off the clearance
  edge, and no bracket around it. The fallback is a zone over the planned
  band, widened by the gap. It applies only where the deeper box would
  overlap another obstacle, cover another rect's port or a waypoint, or
  narrow a passage below one route's width (gap plus stroke) that had room
  before.
- Drop the trades between merged lanes in pipeline.ts. Order now comes from
  the nudge.
- Congestion grouping, side choice, the pull and spread are unchanged.

### Nudge

- A merged end's segment no longer holds at its pin. It is a variable that
  wants the port's line, coupled to its partners at the merge gap. They are
  packed as today's coupled bundle is, so with nothing nearby the lanes
  centre on the port's line, the same picture as today.
- Its order among partners comes from the nudge's usual rule: the side each
  route turns to where the shared stretch ends. That is the order with no
  crossings in the fan.
- **Bounds**: the walls, as for any segment, and the side's extent. Where the
  merge fell back to a zone, also no further than the gap beyond the
  planned outer lanes (case 2 needs 7.4 px, under the 8 px gap).
- The route's end point moves with the segment: it is the lane end at `B`,
  at the nudged offset.
- `stepOut`, the rule for other routes' ends among a merge's lanes, needs
  revisiting. It assumes lanes hold still.

### Whisks

These are unchanged in code: `addWhisk` with the lateral offset the nudge
chose, and `step()` fitted into `[pack, B]` as today (`steps(shrink)`), with
the same locks on corner size and upright. The difference is that the step's
offset is an output of the nudge.

### Collapse (phase B)

Where a channel is too narrow, the nudge already shrinks the gaps of the
segments that crowd it, down to none. v2 changes the order. A bundle's
merge gaps shrink first, down to none, before any full gap between unrelated
routes shrinks. Partners then lie on top of each other, and others keep
their room. With a lane at offset 0, the step is empty and the member runs
straight in.

## Phases

- **A, free lanes**: shared branch pin, lanes as coupled nudge variables,
  whisk from the nudged offset, order from the nudge, widened zone. This
  carries most of the value: case 2's steps go, `n` lane lines become one,
  and order follows topology.
- **B, collapse priority**: partners give way first. Small, if A lands
  cleanly.
- **C, zones and fan**: decide after looking at A. Options are in decisions
  1 and 3.

## Interactions

- **Pinch rule** (uncommitted): it marks lane lines today. With one branch
  line, a member's held run is only the stub to `B`, and `bundled()` exempts
  partners. Re-check its sweep numbers after A.
- **The connectorSnapshots "merging 1/2" change from the pinch rule**: edge
  3 is an unmerged end that spread put on a merge's port, and it now runs
  1 px between lanes for about 92 px. Lanes that move should let the nudge
  separate it. Check again after A.
- **The bracket** is not fully fixed by A. The zone face is still a line
  2.74 px from db's clearance edge. Pieces of a route on lines closer than
  the gap get separated into brackets. If A leaves brackets, the next step
  is decision 3.

## Decisions for Tim

1. **Fan geometry**: keep `step()`, one radius per side of the line. Agreed
   2026-10-19.
2. **How far lanes may move**: along the whole side where the clearance
   deepened. Within the planned band plus the gap where it fell back to a
   zone.
3. **Zones**: deepen the merged side's clearance first, and fall back to a
   zone only where that fails (Tim, 2026-10-19). Open: when two deepened
   faces, such as event bus's left and db's left, land within a gap of each
   other across one channel, snap the nearer out to the farther, so a route
   between them runs on one line and not on two lines a pixel apart.
4. **Stacking (phase B)**: agreed 2026-10-19, as Tim put it, only near a port. Partners may
   stack on their neighbour on the stretch before a member peels off, when
   that member's turn needs the room, and they fan out to the merge gap once
   the outermost has turned. Groups never collapse otherwise. Full stacking
   everywhere is a separate opt-in, not a merge gap of 0. `0` keeps meaning
   strokes that touch, and negative or non-finite already means "use
   `gap`". Proposed: a spec flag, for example `mergeStack: boolean`,
   default `false`, after phase B.

## Verification

Before and after each phase:

- Tim's cases 1 to 4 (`tmp/cases/`), the default and diabolical playground
  states, and PNGs, compared by eye.
- The auth sweep (`tmp/sweep/`): cells with crowded notes, notes with empty
  rects, neighbour flips, distinct outcomes, short jogs.
- The merging snapshots, every diff looked at.
- `pnpm check`, `pnpm typecheck`, `pnpm --filter placement test`.
