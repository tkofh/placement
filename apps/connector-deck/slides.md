---
theme: default
colorSchema: dark
title: Routing connectors
info: |
  How `placement/connector` draws the arrows: the vocabulary, the graph
  search underneath, what we ask of a route and how that becomes cost,
  and the pipeline step by step. A draft for the demo, as of 2026-10-19.
class: text-left
transition: fade
mdc: true
fonts:
  sans: Inter
  mono: JetBrains Mono
---

<div class="eyebrow">placement/connector · draft · 2026-10-19</div>

# Routing connectors

How we draw the arrows between boxes that are already placed

<div class="h-72 mt-6 -mx-4">
  <SceneView scene="services" />
</div>

<!--
Opening: this is the playground's default scene, routed by the code on `hierarchy` today.
Everything drawn in this deck is the real router's output unless a slide says it is hand-drawn.
-->

---

# The job

<div class="grid grid-cols-[1fr_1.6fr] gap-8 mt-2">
<div class="text-sm">

**In**

- rects, already placed
- edges: a source rect and a target rect
- per edge: stroke, corner radius, adornments (arrowheads, labels), optional sides, positions, waypoints
- a spec: `clearance`, `gap`, `bendCost`, `merge`, `jogSlant`, …

**Out**, per edge

- an orthogonal polyline
- the radius of each corner
- where each adornment lands
- **notes**: what it gave up, and how much more room would fix it

</div>
<div class="h-96">
  <SceneView scene="services" layers="rects" />
</div>
</div>

<!--
The connector only routes. It never moves a rect. That is why it has to report: the hierarchy (and later other placers) read the notes and grow room.
-->

---
layout: section
---

# Part 1 · Graphs

The abstract pieces: nodes, edges, costs, paths

---

# Nodes and edges

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="node">
  <Concept kind="node" />
  <template #def>A thing a path can stand on. Also called a <b>vertex</b>. For us, a point in the plane.</template>
</TermCard>
<TermCard term="edge" :builds="['node']">
  <Concept kind="edge" />
  <template #def>A connection between two nodes: you can step from one to the other. For us, a straight line between two points.</template>
</TermCard>
</div>

---

# Weights, paths and cost

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="weight" :builds="['edge']">
  <Concept kind="weight" />
  <template #def>What it costs to cross an edge, never negative. For us, its length, plus whatever else we decide a route should pay for.</template>
</TermCard>
<TermCard term="path · cost" :builds="['edge', 'weight']">
  <Concept kind="path" />
  <template #def>A <b>path</b> is a walk from node to node along edges. Its <b>cost</b> is the sum of the weights it crosses.</template>
</TermCard>
</div>

---

# Shortest paths and half-edges

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="shortest path" :builds="['path · cost']">
  <Concept kind="shortest" />
  <template #def>The cheapest path between two nodes. Not the one with the fewest edges: A → C → E has two, and costs more.</template>
</TermCard>
<TermCard term="half-edge" :builds="['edge']">
  <Concept kind="halfedge" />
  <template #def>An edge taken one way. Each edge is two half-edges. Knowing which way you came in is what lets a search charge for turning.</template>
</TermCard>
</div>

---
layout: section
---

# Part 2 · Pathfinding

Finding the shortest path: Dijkstra, then A*

---

# Settled, frontier, relax

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="settled · frontier" :builds="['shortest path']">
  <Concept kind="frontier" />
  <template #def>A <b>settled</b> node's cheapest cost is known for good. The <b>frontier</b> is every node reached but not settled yet. A search grows the settled set by taking the frontier's cheapest node.</template>
</TermCard>
<TermCard term="relax" :builds="['settled · frontier', 'weight']">
  <WeightedGraph :step="2" />
  <template #def>When a node settles, check each neighbor: if going through it is cheaper, the neighbor takes the new cost and remembers where it came from. Here B settled, and A dropped from 4 to 3.</template>
</TermCard>
</div>

---

# Dijkstra's algorithm

<div class="grid grid-cols-[1fr_1fr] gap-8 mt-2">
<div>

Grow a set of **settled** nodes outward from the start, in order of cost.

1. Every node's best known cost is ∞, except the start's: 0
2. Pick the unsettled node with the lowest cost — the **frontier**'s cheapest
3. **Settle** it: no cheaper path to it can exist, since every other path goes through a frontier node that already costs more, and weights are ≥ 0
4. **Relax** its edges: a neighbor reached cheaper through it takes the new cost and remembers where it came from
5. Repeat until the goal settles; walk the parents back for the path

</div>
<div>

```ts
dist[start] = 0
queue.push(start, 0)
while (queue.size > 0) {
  const n = queue.popCheapest()
  if (settled.has(n)) continue
  settled.add(n)
  if (n === goal) break
  for (const [m, w] of edges(n)) {
    if (dist[n] + w < dist[m]) {
      dist[m] = dist[n] + w
      parent[m] = n
      queue.push(m, dist[m])
    }
  }
}
```

</div>
</div>

---
clicks: 7
---

# Dijkstra, step by step

<div class="grid grid-cols-[1.4fr_1fr] gap-6 mt-2">
<div class="h-[22rem]"><WeightedGraph :step="$clicks" /></div>
<div class="text-sm">

<div class="legend-row"><i style="background:#3f6b3a"></i> settling now <i style="background:#2c4a2a"></i> settled <i style="background:#5a3b22"></i> frontier</div>
<div class="legend-row"><i style="background:#ffb38f"></i> relaxed this step <i style="background:#a8ff8f"></i> best-known tree <i style="background:#fff28f"></i> path</div>

<v-clicks at="1">

- S settles at 0; A gets 4, B gets 2
- B (2) settles; A drops to 3 via B
- A (3) settles; C gets 8
- C (8) settles; D drops to 10, T gets 15
- D (10) settles; T drops to 13
- T (13) settles — done
- the path: S → B → A → C → D → T

</v-clicks>

</div>
</div>

<!--
Click through. Point out that S→A direct (4) loses to S→B→A (3): Dijkstra fixes A only once nothing cheaper can reach it.
-->

---

# A heuristic

<div class="h-[25rem] mt-2">
<TermCard term="heuristic" :builds="['shortest path']" wide>
  <Concept kind="heuristic" />
  <template #def>

A guess **h** at the cost still to go from a node to the goal.

It is **admissible** when it never guesses high. On a graph of horizontal and vertical lines, `|dx| + |dy|` is admissible: no path to the goal is shorter, whatever stands in the way.

A* uses it to settle the nodes that look closer to the goal first.

  </template>
</TermCard>
</div>

---

# A*: Dijkstra with a sense of direction

<div class="grid grid-cols-[1fr_1fr] gap-8 mt-2">
<div>

Dijkstra settles in order of **g**, the cost so far: it ripples out in every direction.

A* settles in order of **f = g + h**, where **h** estimates the cost still to go.

- **admissible**: h never overestimates, so A* still finds the cheapest path
- **consistent**: h never drops by more than a step costs, so a settled node stays settled
- h = 0 is Dijkstra; a perfect h walks straight down the answer

</div>
<div>

On an orthogonal graph the remaining **length** is at least the Manhattan distance `|dx| + |dy|`.

Ours adds:

- the fewest turns the heading still needs, times the bend cost
- through waypoints: to the next one, plus the legs between the rest
- scaled by the smallest weight, and with the merge discount taken off, so it stays a lower bound

Crossings and congestion are left out of h; they only add.

</div>
</div>

---
layout: section
---

# Part 3 · What we want from a connector

The parts of a route, each building on the last, and what we ask of each

---

# Rects, sides and ports

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="rect · side" >
  <Concept kind="rect" />
  <template #def>The boxes, already placed. Each has four <b>sides</b>. An edge can name the side it leaves or enters, or leave it <i>auto</i>.</template>
</TermCard>
<TermCard term="port" :builds="['rect · side']" want="ports spread along a side so routes don't cross at the rect">
  <Concept kind="port" />
  <template #def>Where a route leaves or enters its rect: a point on a side, at a fixed position or an auto one.</template>
</TermCard>
</div>

---

# Clearance, routes and segments

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="clearance · obstacle" :builds="['rect · side']" want="never pass through a rect, or closer than the clearance">
  <Concept kind="clearance" />
  <template #def>Routes keep the <b>clearance</b> from rects they pass. Grown by it, a rect is an <b>obstacle</b>.</template>
</TermCard>
<TermCard term="route · segment" :builds="['port']" want="short">
  <Concept kind="segment" />
  <template #def>A <b>route</b> is an orthogonal polyline from port to port. Each straight stretch between two of its points is a <b>segment</b>, or a <b>run</b>.</template>
</TermCard>
</div>

---

# Port legs and corners

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="port leg" :builds="['route · segment', 'port']" want="leave and enter straight, out of the port">
  <Concept kind="leg" />
  <template #def>The first and last segments, out of the ports. The nudge never moves them sideways; only a sliding port can.</template>
</TermCard>
<TermCard term="corner · radius" :builds="['route · segment']" want="few corners, each at least the radius">
  <Concept kind="corner" />
  <template #def>Where a route turns, also called a <b>bend</b>. It draws as an arc that reaches at least the edge's <b>radius</b> R along both legs.</template>
</TermCard>
</div>

---

# Jogs and kinks

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="jog" :builds="['corner · radius']">
  <Concept kind="jog" />
  <template #def>The middle segment of a Z: between two corners that turn opposite ways.</template>
</TermCard>
<TermCard term="kink" :builds="['jog', 'corner · radius']" want="no kinks: a jog needs room for its corners">
  <SceneView scene="jog-short-upright" layers="rects routes adornments points jogs" :view="[180, 56, 120, 62]" />
  <template #def>A jog shorter than 2R can't hold both corners. Here a 14px jog at R = 16: the corners shrink to 7 and it draws as a kink.</template>
</TermCard>
</div>

---

# Slants and adornments

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="slant · S" :builds="['kink']" want="a short jog that can't be removed reads as one smooth S">
  <SceneView scene="jog-short" layers="rects routes adornments points" :view="[180, 56, 120, 62]" />
  <template #def>The same jog with <code>jogSlant: 2</code>: its corners slide apart along the legs and turn less than a right angle, two arcs that meet halfway.</template>
</TermCard>
<TermCard term="adornment" :builds="['route · segment']" want="labels on a clear stretch of their own">
  <Concept kind="adornment" />
  <template #def>Something drawn on a route. <b>Flow</b> adornments are laid out along it like flex items, at the ends or between. <b>Absolute</b> ones land at a point on the route as drawn.</template>
</TermCard>
</div>

---

# Packs and gaps

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="pack" :builds="['adornment', 'port leg']" want="room at the port for the arrowhead and a corner">
  <Concept kind="pack" />
  <template #def>The room the flow adornments at one end take in front of its port. A corner inside the pack would run into the arrowhead.</template>
</TermCard>
<TermCard term="gap" :builds="['route · segment']" want="a gap between routes that run alongside each other">
  <Concept kind="gap" />
  <template #def>The space kept between routes that run alongside each other.</template>
</TermCard>
</div>

---

# Crossings and channels

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="crossing" :builds="['route · segment']" want="cross rarely, and never for nothing">
  <SceneView scene="corridor" layers="clearance rects routes adornments" />
  <template #def>Two routes running straight through one point, the other way. A1 → B2 and A2 → B1 must cross once.</template>
</TermCard>
<TermCard term="wall · channel" :builds="['clearance · obstacle', 'gap']">
  <Concept kind="channel" />
  <template #def>A segment's <b>walls</b> are the nearest obstacles on either side. The room between them is a <b>channel</b>; the parallel lines through one stretch of it are one <b>slot</b>.</template>
</TermCard>
</div>

---

# Congestion and merges

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="congestion" :builds="['wall · channel', 'gap']" want="out of crowded channels, when there's another way">
  <Concept kind="congestion" />
  <template #def>A slot holding more routes than fit: their strokes and gaps need more than its width.</template>
</TermCard>
<TermCard term="merge" :builds="['port', 'adornment']" want="related ends share one port and one arrowhead">
  <SceneView scene="fan" layers="rects routes adornments" />
  <template #def>Ends on one side of one rect, with the same adornments there, share a port and one copy of the adornments.</template>
</TermCard>
</div>

---

# Lanes, whisks and zones

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="lane · merge gap" :builds="['merge', 'gap']">
  <SceneView scene="fan" layers="rects routes points" phase="ports" :view="[256, 62, 38, 26]" />
  <template #def>Each route into a merge comes in on its own <b>lane</b>, a <b>merge gap</b> from the next, running straight to a whisk length short of the side.</template>
</TermCard>
<TermCard term="whisk · zone" :builds="['lane · merge gap', 'clearance · obstacle']">
  <SceneView scene="services" layers="rects zones routes points" :view="[736, 172, 64, 56]" />
  <template #def>A <b>whisk</b> steps each lane onto the shared port's line, just past the arrowhead. The whisks' box is a <b>zone</b> (pink), walled off from other routes.</template>
</TermCard>
</div>

---

# Bundles and nests

<div class="grid grid-cols-2 gap-6 h-[25rem] mt-2">
<TermCard term="bundle" :builds="['merge', 'lane · merge gap']" want="group up along long shared runs, when that's a local change">
  <SceneView scene="services" :highlight="[10, 11]" :view="[600, 160, 380, 420]" />
  <template #def>Routes of one merge running together from it, coupled at the merge gap, turning together. Mailer and indexer leave the event bus as a bundle.</template>
</TermCard>
<TermCard term="nest" :builds="['corner · radius', 'bundle']" want="routes that turn together keep their spacing through the turn">
  <SceneView scene="services" layers="rects routes adornments points" :view="[620, 90, 110, 70]" :highlight="[6, 8]" />
  <template #def>Corners that turn together share a center, like the lines of a metro map: the outer one grows to 21.75 around the inner one's 16.</template>
</TermCard>
</div>

---

# Notes

<div class="h-[25rem] mt-2">
<TermCard term="note" :builds="['congestion', 'merge', 'adornment']" want="when it can't do all of it, say what it gave up" wide>
  <SceneView scene="diabolical" layers="clearance rects routes adornments" :highlight="[5, 6, 8, 9, 10, 11]" />
  <template #def>

What a layout gave up, and how much more room would have fit it:

- `unrouted` — no route at all
- `crowded` — a channel too narrow for the gaps (here: 7.7px short)
- `cramped` — a merge without room for its lanes
- `overflow` — an adornment longer than every run

The connector never moves a rect; a placer reads the notes and does.

  </template>
</TermCard>
</div>

---

# What we ask of a route

<div class="grid grid-cols-2 gap-x-10 gap-y-2 mt-4 text-[0.95rem]">

<div>

- never pass through a rect; keep the **clearance**
- leave and enter straight, out of the port
- be **short**
- turn **rarely**
- **cross** others rarely
- don't make **kinks**: a jog needs room for its corners

</div>
<div>

- keep a **gap** from routes alongside
- **group up** with related routes along long shared runs — when it's a local change
- leave **room** at the ports for arrowheads and labels
- stay out of **crowded** channels when there's another way
- move **smoothly** as the rects move: no flips over a pixel
- when it can't do all of it, **say what it gave up**

</div>
</div>

<div class="mt-8 text-sm opacity-80">

Most of these are *preferences* that trade against each other. The trick is giving every one of them a price on one scale.

</div>

---

# All the parts at once

<div class="h-[26rem] mt-2">
  <Anatomy />
</div>

<div class="caption">every part at once (hand-drawn)</div>

---
layout: section
---

# Part 4 · The graph we search

Turning rects and ports into nodes and edges

---

# Pins

<div class="h-[25rem] mt-2">
<TermCard term="pin" :builds="['port', 'node', 'half-edge']" wide>
  <Concept kind="pin" />
  <template #def>

A port, as a node of the graph. Its line passes through its own rect's clearance, and it leaves only **outward**: the route can't set off sideways or back into the rect.

The search's headings at a pin are the only ones allowed, so "leave straight out of the port" is not a cost but a shape of the graph.

  </template>
</TermCard>
</div>

---

# The graph we search: orthogonal visibility

<div class="grid grid-cols-[1.5fr_1fr] gap-6 mt-1">
<div class="h-[24rem]">
  <SceneView v-if="$clicks < 1" scene="toy" layers="rects" />
  <SceneView v-else-if="$clicks < 2" scene="toy" layers="clearance rects pins" />
  <SceneView v-else-if="$clicks < 3" scene="toy" layers="clearance graph rects pins" />
  <SceneView v-else scene="toy" layers="clearance graph nodes rects pins" />
</div>
<div class="text-sm">

Wybrow, Marriott & Stuckey 2009.

<v-clicks>

- grow every rect by the **clearance**; add a **pin** at every port
- from every obstacle corner and every pin, run a horizontal and a vertical line until it hits an obstacle's interior
- the **nodes** are where lines cross; each joins the next node along its two lines

</v-clicks>

<div v-click="4" class="mt-4">

It always holds a shortest route for any cost that grows with length and bends. So the search never leaves it, and the routes come out orthogonal.

</div>
</div>
</div>

---

# The same graph on the real scene

<div class="h-[25rem] mt-1">
  <SceneView scene="services" layers="clearance zones graph rects pins" />
</div>

<div class="caption">379 nodes and 680 edges for 11 rects and 13 edges, built on the final ports (pink: merge zones)</div>

---

# Dijkstra vs A* on the toy graph

<SearchPlayer scene="toy" />

<div class="caption mt-2">the deck's own Dijkstra and A*, on the router's visibility graph, pricing length + bends only: same route, same cost, fewer settles for A*</div>

---

# Dijkstra vs A* on the real graph

<SearchPlayer scene="services-search" :speed="25" />

<div class="caption mt-2">web app → exporter across the playground scene (an extra edge, searched alone)</div>

---
clicks: 2
---

# The state is the half-edge, not the node

<div class="grid grid-cols-[1.3fr_1fr] gap-6 mt-2">
<div class="h-80"><TurnStates :step="$clicks + 1" /></div>
<div class="text-sm">

A bend costs, and whether you bend depends on which way you **arrived**. So the search's state is the **half-edge** it came in along: up to four states per node.

<v-click at="2">

The state grows more parts as the costs need them:

- **waypoints**: one layer of states per waypoint still to visit
- **short jogs**: where the current run began, if it's still shorter than 2R, and which way that turn went
- **shared runs**: whether the run was entered where other paths run straight, so a crossing on a shared run is counted

</v-click>
</div>
</div>

---
layout: section
---

# Part 5 · What it costs

How each wish becomes a price on the graph

---

# The ladder

<div class="ladder">
  <div class="rung never">
    <div class="tier">must never</div>
    <div class="how">no edge in the graph · pin directions · infinite weight</div>
    <div class="what">through a rect · reverse on itself · leave a port sideways · cross an <code>avoid</code> rect</div>
  </div>
  <div class="rung cost">
    <div class="tier">avoid at a cost</div>
    <div class="how">a price the search pays</div>
    <div class="what">length · bends · crossings · wrong-way turns · short jogs · tight ends · congestion · held runs</div>
  </div>
  <div class="rung free">
    <div class="tier">prefer when free</div>
    <div class="how">a discount</div>
    <div class="what">running along a merge partner, within the route's own span</div>
  </div>
  <div class="rung tie">
    <div class="tier">tie-break</div>
    <div class="how">order</div>
    <div class="what">equal cost → fewer turns → the path found first (rect key order, edge order)</div>
  </div>
</div>

<div class="caption mt-4">"must never" lives in how the graph is built; everything below it is a number on one scale</div>

---

# One scale: the bend

<div class="grid grid-cols-[1.35fr_1fr] gap-8 mt-1">
<div class="terms compact">

| we want | in the graph | price |
| --- | --- | --- |
| short | edge weight | 1 per px |
| few turns | a state change of heading | **bendCost** |
| few crossings | straight through a node others run straight through | 0.4 × bend |
| turn the preferred way | clockwise / counter-clockwise turns | + 1 × bend |
| no kinks | a Z with jog L < 2R | L / 2R of two bends |
| room at the ports | endpoint cost of a side | up to 2 × bend |
| keep off held runs | marked nodes count as crossings | 6 crossings / node |
| group up | partner half-edges cost less | − 75% of length |
| out of crowded channels | weight × (1 + pressure × overflow) | pressure 0.5 → 4 |

</div>
<div>

`bendCost` is *auto* by default:

```ts
bendCost = 2 * (clearance + gap)  // 48
```

Everything else is a share of it (`problem.ts`), so there's one knob of scale and no knob of speed.

<div class="mt-4 text-sm opacity-80">

"The cost is the cost, we ship quality." Realtime comes from caching, not from trading quality.

</div>
</div>
</div>

---

# Length and bends

<div class="grid grid-cols-[1.5fr_1fr] gap-8 mt-2">
<div class="h-[21rem]">
  <SceneView scene="stairs" layers="clearance rects routes adornments points" v-slot="{ unit }">
    <path d="M120 48 L150 48 L150 144 L320 144 L320 204 L420 204 L420 268 L470 268" fill="none" stroke="#ff8fd6" :stroke-width="1.75 * unit" :stroke-dasharray="`${5 * unit} ${4 * unit}`" />
    <text x="330" y="138" fill="#ff8fd6" :font-size="12 * unit">570 + 6 bends</text>
    <text x="244" y="250" fill="#8fb8ff" :font-size="12 * unit">570 + 2 bends</text>
  </SceneView>
</div>
<div class="text-sm">

Both paths are 570px long: every path that only heads right and down is as long as the Manhattan distance.

| bendCost | Z (taken) | staircase |
| --- | --- | --- |
| 0 | 570 | 570 — tie, fewer turns wins |
| auto (48) | **666** | 858 |

With a bend cost, a turn is worth **48px of detour**: the search takes a longer way around when it saves enough corners — and never trades a corner for less than that.

</div>
</div>

---

# Crossings

<div class="grid grid-cols-[1.3fr_1fr] gap-8 mt-2">
<div class="h-80"><SceneView scene="corridor" layers="clearance rects routes adornments" /></div>
<div class="text-sm">

Routes are searched one after another. Each placed route marks the nodes it runs **straight through**, per axis (`through` counts).

A later route pays **0.4 × bend** for each node it runs straight through the other way — and for:

- running through a node where another route **ends**
- **jogging across** a run others run straight along at both ends
- **dodging**: stepping off a marked line by a short jog and back on

Here A1 → B2 and A2 → B1 *must* cross once; the search makes it exactly once.

</div>
</div>

---

# Kinks: pricing a short jog smoothly

<div class="grid grid-cols-[1.2fr_1fr] gap-8 mt-2">
<div class="h-72"><CostCurve kind="jog" /></div>
<div class="text-sm">

A Z costs two bends. But with a jog shorter than 2R its corners can't both fit — and a 0.5px jog costing two full bends meant a route **flipped** to another the moment a rect moved half a pixel.

Now a jog of length L < 2R costs **L / 2R** of its two turns: nothing at 0, two full bends at 2R. The cost of a route is continuous in the rects' positions.

The search pays it incrementally: the first turn pays as the run grows; a turn the opposite way pays what the first paid. That's why the state remembers where the current run began.

</div>
</div>

---

# Grouping: the merge pull

<div class="grid grid-cols-[1.5fr_1fr] gap-6 mt-2">
<div class="h-[23rem]"><SceneView scene="services" :highlight="[10, 11, 12]" /></div>
<div class="text-sm">

Routes whose ends could merge at one rect **pull** each other: a stretch along a partner's route costs **25%** of its length.

- reaches only within the **span** of the route's own two rects — no wrapping around to ride a partner
- side selection runs a **pull-free first round**, so no route's tie-break locks the group
- then two rounds with the pull let the group settle

Here mailer and indexer leave the event bus on **one** merged port and run down together; exporter, nearer the bus's right side, goes its own way.

</div>
</div>

---

# Congestion: room as a price

<div class="grid grid-cols-[1fr_1fr] gap-6 mt-2">
<div>
  <div class="h-56"><CostCurve kind="congestion" /></div>
  <div class="text-xs opacity-80 mt-2">

A **slot** fills with strokes and gaps. Over its width by `overflow` routes, each px of length costs `1 + pressure × overflow`. Continuous in the width — no capacity cliff.

  </div>
</div>
<div>

Negotiated congestion (PathFinder, McMurchie & Ebeling 1995), without the history term:

1. route everything
2. raise the pressure: 0.5, 1, 2, 4
3. re-route routes in over-full slots, **best gain first**, one at a time
4. stop when nothing moves

A route with a way around leaves; one without stays and the nudge squeezes it.

</div>
</div>

---

# Congestion in the diabolical column

<div class="grid grid-cols-[1.6fr_1fr] gap-6 mt-2">
<div class="h-[23rem]"><SceneView scene="diabolical" layers="clearance rects routes adornments" :highlight="[5, 6, 8, 9, 10, 11]" /></div>
<div class="text-sm">

Billing dragged under the event bus, into the column the db and worker routes need.

Before congestion: 6 **crowded** notes, needing 115px more.

With side selection and the search both pricing room: billing → event bus moves to billing's top, and one note is left, for the highlighted routes:

```json
{ "kind": "crowded",
  "edges": [5, 6, 8, 9, 10, 11],
  "rects": ["billing", "db"],
  "need": 7.7 }
```

</div>
</div>

---

# Rules that aren't a number on an edge

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

**Tight ends.** Each candidate side costs up to 2 × bend for the room it lacks in front of its port for the pack and a corner. A route comes in on a side with room when that's cheaper than the way around.

**Turn preference.** `turn: clockwise` charges the other turn one more bend.

**Waypoints.** Layers of state; arriving and leaving headings constrain the pins.

</div>
<div>

**Held runs.** Port legs and waypoint runs can't be nudged. Another route that would share one, or lie in a strip beside one too narrow for gap + strokes, is searched again with those nodes costing **6 crossings** each.

**Shared-run crossings.** Two routes that ride one run and cross on it are caught after the fact, and the later one re-searched with the crossing priced.

</div>
</div>

---
layout: section
---

# Part 6 · The pipeline

Ten phases, each a function of the problem and the phases before it

---

# The pipeline

<div class="grid grid-cols-[1fr_1.3fr] gap-8 mt-2">
<PipelineStrip vertical />
<div class="text-sm">

**search** phases find paths on a graph (blue)

**plan** phases decide where ports and merges go (purple)

**geometry** phases move segments of found routes (green)

**dress** phases size corners and place what's drawn on the routes (brown)

<div class="mt-6">

`solve(problem, trace?)` in `internal/connector/pipeline.ts`. The `trace` hook reports routes after `search`, `nudge`, `ports`, `whisks` and `slants` — which is how every phase slide here is drawn.

</div>
<div class="mt-4 opacity-80">

`normalize` runs first: rects by index, grown into obstacles; edges with ends, costs, adornments; all from the spec's one scale.

</div>
</div>
</div>

---
clicks: 3
---

# One edge, through the whole pipeline

<PipelineStrip :at="[4, 5, 6, 9][$clicks] ?? 9" />

<div class="grid grid-cols-[1.6fr_1fr] gap-6 mt-3">
<div class="h-[21rem]">
  <SceneView v-if="$clicks === 0" scene="toy" layers="clearance graph rects routes points" phase="search" />
  <SceneView v-else-if="$clicks === 1" scene="toy" layers="clearance rects routes points" phase="nudge" ghost="search" />
  <SceneView v-else-if="$clicks === 2" scene="toy" layers="clearance rects routes points" phase="ports" ghost="nudge" />
  <SceneView v-else scene="toy" layers="clearance rects routes adornments points" />
</div>
<div class="text-sm">
<div v-if="$clicks === 0">

**search**: the cheapest path on the graph, node by node, hugging the obstacles' clearance lines.

</div>
<div v-else-if="$clicks === 1">

**nudge**: collinear points collapse into segments; the jog moves to `jogAt` (the middle) of its run.

</div>
<div v-else-if="$clicks === 2">

**straighten**: B's port slides up its side to shorten the short jog before it.

</div>
<div v-else>

**corners + slants**: the residue becomes an S; corners get their radius; the arrowhead lands.

</div>
</div>
</div>

---

# 1 · Sides

<PipelineStrip :at="1" />

<div class="grid grid-cols-[1.6fr_1fr] gap-6 mt-3">
<div class="h-[22rem]"><SceneView scene="services" layers="rects candidates routes" phase="trial" /></div>
<div class="text-sm">

Every **auto** end gets a candidate port in the middle of all four sides (yellow), on **one** graph.

One search per edge picks the cheapest start and end among them, weighing:

- the route between them
- the **tight-end** cost of each side
- the **merge pull** (after a pull-free first round)
- **congestion** among the trial routes

The trial routes (shown) also order the ports that will share a side.

</div>
</div>

---

# 2 · Ports

<PipelineStrip :at="2" />

<div class="grid grid-cols-[1.6fr_1fr] gap-6 mt-3">
<div class="h-[22rem]"><SceneView scene="services" layers="rects ports" /></div>
<div class="text-sm">

Fixed positions resolve directly. Auto ports that share a side **spread evenly** along it, in the order the trial routes part: the one that parts toward an end of the side gets the port nearer that end, so the routes **nest instead of crossing** at the rect.

Ends that **merge** — one side, same adornments at the end — take one spot among the others.

</div>
</div>

---

# 3 · Merges

<PipelineStrip :at="3" />

<div class="grid grid-cols-2 gap-6 mt-3">
<div>
  <div class="grid grid-cols-2 gap-3">
    <div class="h-48"><SceneView scene="services" layers="rects zones routes points" :view="[736, 172, 64, 56]" /></div>
    <div class="h-48"><SceneView scene="services" layers="rects zones routes points" :view="[736, 352, 64, 56]" /></div>
  </div>
  <div class="caption">the event bus's left side and postgres's left side: lanes, whisks, zones (pink)</div>
</div>
<div class="text-sm">

Each merge lays out its **lanes**: one per route, a merge gap apart, centered on the shared port, running straight out to a whisk length from the side.

The **whisks** — the steps from the lanes onto the port's line — are walled off as **zones** (pink), so other routes keep out of them.

A merge with no room for its lanes is reported as **cramped**.

</div>
</div>

---

# 4 · Search

<PipelineStrip :at="4" />

<div class="grid grid-cols-[1.6fr_1fr] gap-6 mt-3">
<div class="h-[22rem]"><SceneView scene="services" layers="clearance zones rects routes points" phase="search" /></div>
<div class="text-sm">

A fresh graph on the final ports. Every route is found **among the others**: crossings, held runs, congestion — the whole price list.

- rounds of rising **pressure**, re-routing the over-full
- re-search for held runs and shared-run crossings
- neighboring ends on a side may **trade** ports when that crosses less

Routes may **share** lines here. The dots are graph nodes: the path is still a walk on the graph.

</div>
</div>

---

# 5 · Nudge

<PipelineStrip :at="5" />

<div class="grid grid-cols-2 gap-6 mt-3">
<div>
  <div class="h-56"><SceneView scene="corridor" layers="clearance rects routes points" phase="search" /></div>
  <div class="caption">after search: both routes on one line through the gap</div>
</div>
<div>
  <div class="h-56"><SceneView scene="corridor" layers="clearance rects routes points" phase="nudge" /></div>
  <div class="caption">after nudge: a gap apart, crossing once</div>
</div>
</div>

<div class="text-sm mt-3">

Segments move **sideways**, vertical ones first, then horizontal, by a separation solver. The **order** of two routes on a shared stretch comes from where they part; when the two ends disagree a crossing is unavoidable and the order is *loose*. Port legs stay put; bundles stay coupled at the merge gap; jogs go to `jogAt`. In a channel too narrow for the gap, the gaps **shrink** — never into a rect — and the channel is reported as **crowded**.

</div>

---

# 5 · Nudge, on the real scene

<PipelineStrip :at="5" />

<div class="h-[24rem] mt-3"><SceneView scene="services" layers="rects routes" phase="nudge" ghost="search" /></div>

<div class="caption">solid: after nudge · dashed: after search</div>

---

# 6 · Straighten ports

<PipelineStrip :at="6" />

<div class="grid grid-cols-3 gap-4 mt-3">
<div>
  <div class="h-44"><SceneView scene="jog-slide" layers="rects routes points jogs" phase="nudge" /></div>
  <div class="caption">nudged: a 14px jog right past the port</div>
</div>
<div>
  <div class="h-44"><SceneView scene="jog-slide" layers="rects routes points" phase="ports" ghost="nudge" /></div>
  <div class="caption">the auto ports slide along their sides: straight</div>
</div>
<div>
  <div class="h-44"><SceneView scene="services" layers="rects routes points" phase="ports" ghost="nudge" :view="[270, 200, 220, 230]" :highlight="[2, 5]" /></div>
  <div class="caption">gateway → auth and auth → db slide part of the way</div>
</div>
</div>

<div class="text-sm mt-4">

An auto port that neither merges nor belongs to a loop slides to the line past a short jog — clear of the side's ends by the gap, its leg clear of rects and of neighbors by the gap. A jog a little longer than half what its corners need slides only **part** of the way; the residue becomes an S later.

</div>

---

# 7 · Whisks and locks

<PipelineStrip :at="7" />

<div class="grid grid-cols-2 gap-6 mt-3">
<div>
  <div class="h-48"><SceneView scene="fan" layers="rects routes points" phase="ports" :view="[256, 62, 38, 26]" /></div>
  <div class="caption">before: three lanes end at the lane ends</div>
</div>
<div>
  <div class="h-48"><SceneView scene="fan" layers="rects routes points" phase="whisks" :view="[256, 62, 38, 26]" /></div>
  <div class="caption">after: each lane whisks onto the shared port</div>
</div>
</div>

<div class="text-sm mt-3">

Merged ends get their whisks added. **Locks** carry decisions forward: a whisk's corners keep their size, a jog in a bundle or where a route parts from its group stays **upright** — the corner and slant passes leave them alone.

</div>

---

# 8 · Flow adornments

<PipelineStrip :at="8" />

<div class="grid grid-cols-[1.5fr_1fr] gap-6 mt-3">
<div class="h-[21rem]"><SceneView scene="services" :highlight="[2, 5]" /></div>
<div class="text-sm">

Each straight run is a **flex container** with no thickness, its main axis toward the target.

- adornments at `0` / `1` **pack** against the ports (arrowheads)
- the others go to the run nearest their `at` with room for them and its corners, justified like flex items
- a stretch where no other route comes near is preferred — so `jwt` and `sql` sit in the clear

The space they take **walls off** corners.

</div>
</div>

---

# 9 · Corners and slants

<PipelineStrip :at="9" />

<div class="grid grid-cols-2 gap-6 mt-3">
<div>
  <div class="grid grid-cols-2 gap-2">
    <div class="h-28"><SceneView scene="jog-short-upright" layers="rects routes adornments points" /></div>
    <div class="h-28"><SceneView scene="jog-short" layers="rects routes adornments points" /></div>
  </div>
  <div class="caption">a kink, and the S that replaces it</div>
  <div class="h-44 mt-3"><SceneView scene="services" layers="rects routes adornments points" :view="[620, 90, 110, 70]" :highlight="[6, 8]" /></div>
  <div class="caption">orders → event bus grows its corner to 21.75 around orders → postgres: one center through the turn</div>
</div>
<div class="text-sm">

**Corners** reach at least the edge's radius along both legs — a radius smaller than that is a routing failure (a leg too short), not something corners fix. Corners that turn together **nest** outward from the innermost.

**Slants**: a jog shorter than its corners need becomes an **S**, spanning `2·k·reach − (k−1)·d`. At `d = 2·reach` it's exactly the two full corners, so it never jumps as the rects move.

Then the corners **settle** again on the routes as drawn.

</div>
</div>

---

# 10 · Land the rest, and write the notes

<PipelineStrip :at="10" />

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

**Absolute** adornments land on the route as drawn, corners and all.

Then the **notes**: what the routes gave up, and what would have fit them.

| kind | means | carries |
| --- | --- | --- |
| `unrouted` | no route at all | the edge |
| `crowded` | a channel too narrow for the gaps | edges, rects, axis, **need** |
| `cramped` | a merge with no room for its lanes | rect, side, **need** |
| `overflow` | an adornment longer than every run | edge, adornment, **need** |

</div>
<div>

The connector only routes. A layout that **places** the rects reads the notes and moves them apart.

The hierarchy does this today: up to 3 rounds, growing channels and pair room from the notes (`Growth`).

</div>
</div>

---

# All together

<div class="h-[26rem] mt-2"><SceneView scene="services" /></div>

---
layout: section
---

# Part 7 · Where we are

The algorithm isn't done; this is the state on 2026-10-19

---

# Working

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

- one pipeline, ten phases, each testable alone (`trace`)
- one cost scale from `bendCost`; no speed knobs
- short jogs priced continuously — no 0.5px cliff
- crossings counted on shared runs, at lane ends, around dodges
- merge pull that groups long shared runs only within a route's span
- negotiated congestion in side selection and search

</div>
<div>

- radius is a floor; nests grow outward and keep their center
- S slants that meet the orthogonal shape at both ends
- notes that tell a placer how much room to add
- the hierarchy routes through `Connector.apply`
- the scene tool replays any playground state against the source

</div>
</div>

---

# Sore spot: small moves, big swings

<div class="grid grid-cols-[1.5fr_1fr] gap-6 mt-2">
<div>
  <div class="grid grid-cols-2 gap-2">
    <div class="h-40"><SceneView scene="auth-1" :highlight="[5, 7, 9, 10, 11]" /></div>
    <div class="h-40"><SceneView scene="auth-2" :highlight="[5, 7, 9, 10, 11]" /></div>
    <div class="h-40"><SceneView scene="auth-3" :highlight="[5, 7, 9, 10, 11]" /></div>
    <div class="h-40"><SceneView scene="auth-4" :highlight="[5, 7, 9, 10, 11]" /></div>
  </div>
  <div class="caption">only <b>auth</b> moves between these four (problem-cases.md); lit: the routes that swing</div>
</div>
<div class="text-sm">

Not congestion — measured: the same routes before and after it. But thresholds are dense: 18 different outcomes over 100px of auth's y.

- ~40% are **side flips** (billing's ends: top/bottom ↔ right)
- mailer and indexer ride the db bundle's **held lanes**; auth's lines land within ~1px of them, so near-free hops reorder near-ties
- the nudge squeezes what runs beside a held bundle stretch — the congestion model only counts obstacle walls, so it can't see it
- a loop around db's merge zone, with 15.5px jogs, costs less than going around db

</div>
</div>

---

# Open threads

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

**Merges v2: lanes as a preference.** Partners collapse onto the port's line near the port, peel off with corners sized by the corner system, spread to the merge gap where there's room. Removes the lane-end seam, zone strips, tiny whisk steps.

**Held bundles as walls** for parallel runs, in channels and/or blocking.

**Search vs nudge mismatch.** The nudge treats a whole segment against its nearest wall; the search prices only the narrow stretch.

</div>
<div>

**`dodged()` is provisional** — inexact on 3 of 120 adversarial graphs.

**Whisks** turn tighter than the radius, on purpose, for now.

**Prefer the periphery when free** — the event bus → workers example, once congestion settles.

**Caching** across calls, for realtime.

</div>
</div>

---

# Toward the demo

<div class="grid grid-cols-2 gap-8 mt-4 text-sm">
<div>

Ideas for the live version:

- drag a rect in the playground with the **phase scrubber**: search → nudge → ports → whisks → slants
- toggle the **graph** and **zones** layers live
- show **notes** as overlays: the crowded channel, the need
- the **ladder**, with one example per rung, built from real scenes
- Dijkstra vs A* on the *real* scene's graph, live

</div>
<div>

Regenerate everything here from the router:

```sh
pnpm --filter @placement/connector-deck scenes
pnpm --filter @placement/connector-deck slides
```

Scenes live in `scripts/scenes.ts`; every drawing reads `data/*.json`.

</div>
</div>

---
layout: section
---

# Appendix · Glossary

Every term on one page

---

# Terms: one route

<div class="terms">

| term | meaning |
| --- | --- |
| **rect** / **obstacle** | a box routes avoid; grown by the **clearance** into an obstacle |
| **side** | top, right, bottom, left of a rect; *auto* when the edge doesn't say |
| **port** | where a route leaves or enters its rect, on a side |
| **pin** | a port as a node of the graph, with the headings it may leave in |
| **segment** / **run** | a straight stretch of a route |
| **port leg** | the first or last segment, out of a port; it never moves sideways |
| **corner** / **bend** | where a route turns; drawn as an arc of at least the edge's **radius** |
| **jog** | the middle segment of a Z: between two corners that turn opposite ways |
| **kink** | a jog too short for its two corners (shorter than 2R) |
| **slant** / **S** | a short jog drawn as two arcs that meet halfway, instead of a kink |
| **adornment** | something drawn on a route: *flow* (packed along it) or *absolute* |
| **pack** | the room the flow adornments at an end take in front of the port |

</div>

---

# Terms: routes together

<div class="terms">

| term | meaning |
| --- | --- |
| **gap** | the space kept between routes that run alongside each other |
| **crossing** | two routes running straight through one point, the other way |
| **channel** / **slot** | the room between two walls that parallel runs share |
| **wall** | the nearest obstacle on one side of a run |
| **congestion** | a slot holding more routes (strokes + gaps) than its width |
| **merge** | ends on one side of one rect, with the same adornments, sharing one port |
| **lane** | one route's line into a merge, a **merge gap** from the next |
| **whisk** | the step from a lane onto the shared port's line, just past the arrowhead |
| **zone** | the box the whisks need, walled off for other routes |
| **bundle** | routes of one merge running together from it, coupled at the merge gap |
| **nest** | corners that turn together and share a center, like a metro map |
| **note** | what a layout gave up: *unrouted*, *crowded*, *cramped*, *overflow* |

</div>
