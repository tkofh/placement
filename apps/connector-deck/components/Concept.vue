<script setup lang="ts">
import { computed } from 'vue'
import { type XY, pathOf } from '../utils/scene'

// Small hand-drawn pictures of single concepts, for the term cards. Each
// `kind` draws one idea in a 400 x 220 box; where a picture builds on an
// earlier one, it reuses its drawing.

const props = defineProps<{ kind: string }>()

// The abstract graph the graph terms share.
const NODES: Record<string, XY> = {
  A: [50, 110],
  B: [150, 45],
  C: [160, 175],
  D: [270, 100],
  E: [355, 160],
}
const EDGES: Array<[string, string, number]> = [
  ['A', 'B', 3],
  ['A', 'C', 4],
  ['B', 'D', 2],
  ['C', 'D', 6],
  ['B', 'C', 2],
  ['D', 'E', 4],
  ['C', 'E', 9],
]
const at = (n: string) => NODES[n] as XY
const mid = (a: string, b: string): XY => [(at(a)[0] + at(b)[0]) / 2, (at(a)[1] + at(b)[1]) / 2]
const line = (list: Array<string>) =>
  list.map((n, k) => `${k ? 'L' : 'M'}${at(n)[0]} ${at(n)[1]}`).join(' ')
const onPath = (path: Array<string>, a: string, b: string) =>
  path.some((n, k) => k > 0 && ((path[k - 1] === a && n === b) || (path[k - 1] === b && n === a)))

const graphKinds = ['node', 'edge', 'weight', 'path', 'shortest']
const isGraph = computed(() => graphKinds.includes(props.kind))
const best = ['A', 'B', 'D', 'E']
const other = ['A', 'C', 'E']
const edgeStroke = (a: string, b: string) => {
  if (props.kind === 'path' && onPath(best, a, b)) return '#fff28f'
  if (props.kind === 'shortest' && onPath(best, a, b)) return '#fff28f'
  if (props.kind === 'shortest' && onPath(other, a, b)) return '#ffb38f'
  return '#6b7393'
}

// A rect the connector terms share.
const R = { x: 120, y: 70, width: 160, height: 80 }
const C = 22
</script>

<template>
  <svg viewBox="0 0 400 220" class="concept">
    <defs>
      <marker
        id="c-arrow"
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="6"
        markerHeight="6"
        orient="auto-start-reverse"
      >
        <path d="M0 0 L10 5 L0 10 Z" fill="context-stroke" />
      </marker>
    </defs>

    <!-- graph terms -->
    <g v-if="isGraph">
      <g v-if="kind !== 'node'">
        <g v-for="[a, b, w] in EDGES" :key="`${a}${b}`">
          <line
            :x1="at(a)[0]"
            :y1="at(a)[1]"
            :x2="at(b)[0]"
            :y2="at(b)[1]"
            :stroke="edgeStroke(a, b)"
            :stroke-width="edgeStroke(a, b) === '#6b7393' ? 2 : 4"
          />
          <template v-if="kind !== 'edge'">
            <circle :cx="mid(a, b)[0]" :cy="mid(a, b)[1]" r="10" fill="#0b0e19" />
            <text :x="mid(a, b)[0]" :y="mid(a, b)[1] + 4.5" text-anchor="middle" class="w">
              {{ w }}
            </text>
          </template>
        </g>
      </g>
      <g v-for="(xy, n) in NODES" :key="n">
        <circle :cx="xy[0]" :cy="xy[1]" r="17" fill="#243258" stroke="#ffffff70" stroke-width="1.5" />
        <text :x="xy[0]" :y="xy[1] + 5.5" text-anchor="middle" class="n">{{ n }}</text>
      </g>
      <text v-if="kind === 'path'" x="200" y="214" text-anchor="middle" class="note" fill="#fff28f">
        A → B → D → E costs 3 + 2 + 4 = 9
      </text>
      <text v-if="kind === 'shortest'" x="200" y="214" text-anchor="middle" class="note">
        <tspan fill="#fff28f">A → B → D → E = 9</tspan>
        <tspan fill="#ffb38f" dx="16">A → C → E = 13</tspan>
      </text>
    </g>

    <!-- a half-edge: one edge, two directions -->
    <g v-else-if="kind === 'halfedge'">
      <line x1="90" y1="110" x2="310" y2="110" stroke="#6b7393" stroke-width="2" stroke-dasharray="4 4" />
      <path d="M112 96 L288 96" stroke="#8fb8ff" stroke-width="3" marker-end="url(#c-arrow)" />
      <path d="M288 124 L112 124" stroke="#ffb38f" stroke-width="3" marker-end="url(#c-arrow)" />
      <circle cx="80" cy="110" r="17" fill="#243258" stroke="#ffffff70" stroke-width="1.5" />
      <text x="80" y="115.5" text-anchor="middle" class="n">A</text>
      <circle cx="320" cy="110" r="17" fill="#243258" stroke="#ffffff70" stroke-width="1.5" />
      <text x="320" y="115.5" text-anchor="middle" class="n">B</text>
      <text x="200" y="86" text-anchor="middle" class="note" fill="#8fb8ff">A → B</text>
      <text x="200" y="146" text-anchor="middle" class="note" fill="#ffb38f">B → A</text>
      <text x="200" y="196" text-anchor="middle" class="note">one edge = two half-edges</text>
    </g>

    <!-- frontier and settled -->
    <g v-else-if="kind === 'frontier'">
      <circle cx="200" cy="110" r="70" fill="#2c4a2a50" stroke="#a8ff8f" stroke-dasharray="4 4" />
      <circle cx="200" cy="110" r="9" fill="#a8ff8f" />
      <circle v-for="[x, y] in [[170, 90], [225, 85], [215, 140], [175, 135]]" :key="`s${x}`" :cx="x" :cy="y" r="7" fill="#a8ff8f" />
      <circle
        v-for="[x, y] in [[105, 70], [290, 70], [300, 150], [120, 170], [200, 25], [205, 200]]"
        :key="`f${x}`"
        :cx="x"
        :cy="y"
        r="8"
        fill="none"
        stroke="#ffb38f"
        stroke-width="2"
      />
      <circle v-for="[x, y] in [[40, 40], [370, 30], [365, 195], [30, 190]]" :key="`u${x}`" :cx="x" :cy="y" r="6" fill="#4b5270" />
      <text x="200" y="114" text-anchor="middle" class="tiny" fill="#0b0e19">S</text>
      <text x="236" y="114" class="note" fill="#a8ff8f">settled</text>
      <text x="300" y="128" class="note" fill="#ffb38f">frontier</text>
      <text x="20" y="214" class="note" fill="#8a93b8">unseen</text>
    </g>

    <!-- a heuristic: the Manhattan distance never overestimates -->
    <g v-else-if="kind === 'heuristic'">
      <g stroke="#ffffff10">
        <line v-for="x in 10" :key="`x${x}`" :x1="x * 40" y1="0" :x2="x * 40" y2="220" />
        <line v-for="y in 5" :key="`y${y}`" x1="0" :y1="y * 40" x2="400" :y2="y * 40" />
      </g>
      <rect x="180" y="50" width="60" height="130" fill="#30343f" stroke="#ffffff30" />
      <path d="M80 160 L320 160 L320 60" fill="none" stroke="#fff28f" stroke-width="2.5" stroke-dasharray="6 4" />
      <path d="M80 160 L80 30 L320 30 L320 60" fill="none" stroke="#a8ff8f" stroke-width="2.5" />
      <circle cx="80" cy="160" r="9" fill="#8fb8ff" />
      <circle cx="320" cy="60" r="9" fill="#ff8fd6" />
      <text x="94" y="190" class="note" fill="#fff28f">h = |dx| + |dy| = 340</text>
      <text x="94" y="22" class="note" fill="#a8ff8f">real cost to go = 400 ≥ h</text>
      <text x="58" y="148" class="tiny">n</text>
      <text x="334" y="64" class="tiny">goal</text>
    </g>

    <!-- a rect and its sides -->
    <g v-else-if="kind === 'rect'">
      <rect v-bind="R" rx="10" fill="#243258" stroke="#ffffff50" />
      <text x="200" y="115" text-anchor="middle" class="n">rect</text>
      <text x="200" y="60" text-anchor="middle" class="note" fill="#fff28f">top</text>
      <text x="290" y="114" class="note" fill="#fff28f">right</text>
      <text x="200" y="172" text-anchor="middle" class="note" fill="#fff28f">bottom</text>
      <text x="110" y="114" text-anchor="end" class="note" fill="#fff28f">left</text>
    </g>

    <!-- ports on sides -->
    <g v-else-if="kind === 'port'">
      <rect v-bind="R" rx="10" fill="#243258" stroke="#ffffff50" />
      <line x1="280" y1="110" x2="340" y2="110" stroke="#8fb8ff" stroke-width="2.5" marker-end="url(#c-arrow)" />
      <line x1="160" y1="150" x2="160" y2="205" stroke="#ffb38f" stroke-width="2.5" marker-end="url(#c-arrow)" />
      <line x1="240" y1="150" x2="240" y2="205" stroke="#a8ff8f" stroke-width="2.5" marker-end="url(#c-arrow)" />
      <circle cx="280" cy="110" r="5.5" fill="#fff28f" />
      <circle cx="160" cy="150" r="5.5" fill="#fff28f" />
      <circle cx="240" cy="150" r="5.5" fill="#fff28f" />
      <text x="290" y="96" class="tiny">right, at 0.5</text>
      <text x="130" y="60" class="tiny">two ports sharing the bottom side</text>
    </g>

    <!-- clearance: the rect grown into an obstacle -->
    <g v-else-if="kind === 'clearance'">
      <rect :x="R.x - C" :y="R.y - C" :width="R.width + 2 * C" :height="R.height + 2 * C" rx="3" fill="#ffffff08" stroke="#ffffff80" stroke-dasharray="5 4" />
      <rect v-bind="R" rx="10" fill="#243258" stroke="#ffffff50" />
      <line :x1="R.x + R.width" y1="110" :x2="R.x + R.width + C" y2="110" stroke="#fff28f" stroke-width="1.5" marker-start="url(#c-arrow)" marker-end="url(#c-arrow)" />
      <text :x="R.x + R.width + C + 6" y="114" class="tiny" fill="#fff28f">clearance</text>
      <text x="200" y="115" text-anchor="middle" class="n">rect</text>
      <text x="200" y="40" text-anchor="middle" class="note" fill="#ffffffa0">obstacle: routes stay outside</text>
      <path d="M20 190 L380 190" fill="none" stroke="#8fb8ff" stroke-width="2" />
      <text x="20" y="210" class="tiny" fill="#8fb8ff">a route passing outside</text>
    </g>

    <!-- a pin: a port as a node of the graph, leaving only outward -->
    <g v-else-if="kind === 'pin'">
      <rect :x="R.x - C" :y="R.y - C" :width="R.width + 2 * C" :height="R.height + 2 * C" rx="3" fill="#ffffff08" stroke="#ffffff60" stroke-dasharray="5 4" />
      <rect v-bind="R" rx="10" fill="#243258" stroke="#ffffff50" />
      <line x1="280" y1="110" x2="395" y2="110" stroke="#6f8cff" stroke-width="2" />
      <line x1="370" y1="10" x2="370" y2="210" stroke="#6f8cff" stroke-width="1.5" style="opacity: 0.6" />
      <circle cx="370" cy="110" r="4" fill="#9fb3ff" />
      <line x1="280" y1="110" x2="200" y2="110" stroke="#ff5f6d" stroke-width="2" stroke-dasharray="3 3" />
      <line x1="280" y1="110" x2="280" y2="40" stroke="#ff5f6d" stroke-width="2" stroke-dasharray="3 3" />
      <line x1="280" y1="110" x2="280" y2="180" stroke="#ff5f6d" stroke-width="2" stroke-dasharray="3 3" />
      <text x="190" y="114" text-anchor="end" class="tiny" fill="#ff5f6d">✕</text>
      <text x="276" y="34" class="tiny" fill="#ff5f6d">✕</text>
      <text x="276" y="196" class="tiny" fill="#ff5f6d">✕</text>
      <circle cx="280" cy="110" r="6.5" fill="#fff28f" />
      <text x="98" y="212" class="tiny" fill="#fff28f">the pin leaves right only; the other ways are closed</text>
    </g>

    <!-- the gap between routes alongside -->
    <g v-else-if="kind === 'gap'">
      <path d="M30 90 L370 90" stroke="#8fb8ff" stroke-width="2.5" />
      <path d="M30 130 L370 130" stroke="#ffb38f" stroke-width="2.5" />
      <line x1="200" y1="93" x2="200" y2="127" stroke="#fff" stroke-width="1.2" marker-start="url(#c-arrow)" marker-end="url(#c-arrow)" />
      <text x="210" y="115" class="note" fill="#fff">gap</text>
    </g>

    <!-- a channel: the room between two walls -->
    <g v-else-if="kind === 'channel' || kind === 'congestion'">
      <rect x="110" y="0" width="180" height="70" fill="#30343f" stroke="#ffffff30" />
      <rect x="110" y="150" width="180" height="70" fill="#30343f" stroke="#ffffff30" />
      <line x1="110" y1="70" x2="290" y2="70" stroke="#fff28f" stroke-width="3" />
      <line x1="110" y1="150" x2="290" y2="150" stroke="#fff28f" stroke-width="3" />
      <text x="296" y="66" class="tiny" fill="#fff28f">wall</text>
      <text x="296" y="160" class="tiny" fill="#fff28f">wall</text>
      <template v-if="kind === 'channel'">
        <line v-for="y in [70, 96, 124, 150]" :key="y" x1="20" :y1="y" x2="380" :y2="y" stroke="#6f8cff" stroke-width="1.2" style="opacity: 0.6" />
        <rect x="110" y="70" width="180" height="80" fill="#6f8cff18" />
        <text x="200" y="114" text-anchor="middle" class="tiny" fill="#9fb3ff">one slot: every line through the same room</text>
        <line x1="70" y1="72" x2="70" y2="148" stroke="#fff" stroke-width="1.2" marker-start="url(#c-arrow)" marker-end="url(#c-arrow)" />
        <text x="60" y="114" text-anchor="end" class="tiny">width</text>
      </template>
      <template v-else>
        <path v-for="(y, k) in [80, 92, 104, 116, 128, 140]" :key="y" :d="`M10 ${y} L390 ${y}`" :stroke="['#8fb8ff', '#ffb38f', '#a8ff8f', '#ff8fd6', '#fff28f', '#8ffff2'][k]" stroke-width="2" />
        <text x="200" y="190" text-anchor="middle" class="note" fill="#ff5f6d" style="paint-order: stroke" stroke="#0b0e19" stroke-width="4">6 routes need 6 strokes + gaps &gt; width</text>
      </template>
    </g>

    <!-- adornments: flow and absolute -->
    <g v-else-if="kind === 'adornment'">
      <rect x="320" y="80" width="70" height="60" rx="8" fill="#243258" stroke="#ffffff50" />
      <path d="M10 110 L320 110" stroke="#8fb8ff" stroke-width="2.5" />
      <path d="M320 110 L307 103 L307 117 Z" fill="#8fb8ff" />
      <rect x="140" y="101" width="50" height="18" rx="4" fill="#0b0e19" stroke="#8fb8ff" />
      <text x="165" y="114" text-anchor="middle" class="tiny" fill="#8fb8ff">jwt</text>
      <circle cx="80" cy="76" r="11" fill="#0b0e19" stroke="#ffb38f" />
      <text x="80" y="80" text-anchor="middle" class="tiny" fill="#ffb38f">1</text>
      <text x="252" y="80" text-anchor="middle" class="tiny" fill="#8fb8ff">flow, at 1: arrowhead</text>
      <text x="165" y="150" text-anchor="middle" class="tiny" fill="#8fb8ff">flow, between: label</text>
      <text x="80" y="54" text-anchor="middle" class="tiny" fill="#ffb38f">absolute: badge</text>
    </g>

    <!-- the pack: what the end's flow adornments take in front of the port -->
    <g v-else-if="kind === 'pack'">
      <rect x="300" y="60" width="90" height="100" rx="8" fill="#243258" stroke="#ffffff50" />
      <path d="M10 110 L300 110" stroke="#8fb8ff" stroke-width="2.5" />
      <path d="M300 110 L287 103 L287 117 Z" fill="#8fb8ff" />
      <circle cx="270" cy="110" r="6" fill="#0b0e19" stroke="#8fb8ff" stroke-width="2" />
      <line x1="258" y1="140" x2="300" y2="140" stroke="#d68fff" stroke-width="2" />
      <line x1="258" y1="134" x2="258" y2="146" stroke="#d68fff" stroke-width="2" />
      <line x1="300" y1="134" x2="300" y2="146" stroke="#d68fff" stroke-width="2" />
      <text x="279" y="166" text-anchor="middle" class="note" fill="#d68fff">pack</text>
      <text x="120" y="96" text-anchor="middle" class="tiny" fill="#ffffffa0">a corner here would hit the arrowhead</text>
    </g>

    <!-- a segment, a corner, a jog, drawn on one Z -->
    <g v-else-if="['segment', 'leg', 'corner', 'jog'].includes(kind)">
      <rect x="10" y="30" width="80" height="44" rx="8" fill="#243258" stroke="#ffffff50" />
      <rect x="310" y="146" width="80" height="44" rx="8" fill="#4f3519" stroke="#ffffff50" />
      <path :d="pathOf([[90, 52], [200, 52], [200, 168], [310, 168]], kind === 'segment' ? [] : [0, 22, 22, 0])" fill="none" stroke="#8fb8ff" stroke-width="2.5" />
      <template v-if="kind === 'segment'">
        <line x1="90" y1="52" x2="200" y2="52" stroke="#fff28f" stroke-width="6" style="opacity: 0.5" />
        <line x1="200" y1="52" x2="200" y2="168" stroke="#ff8fd6" stroke-width="6" style="opacity: 0.5" />
        <line x1="200" y1="168" x2="310" y2="168" stroke="#a8ff8f" stroke-width="6" style="opacity: 0.5" />
        <circle v-for="[x, y] in [[90, 52], [200, 52], [200, 168], [310, 168]]" :key="`${x}${y}`" :cx="x" :cy="y" r="4" fill="#fff" />
        <text x="14" y="212" class="tiny">a route is points; between them, segments</text>
      </template>
      <template v-else-if="kind === 'leg'">
        <line x1="90" y1="52" x2="178" y2="52" stroke="#fff28f" stroke-width="6" style="opacity: 0.5" />
        <line x1="222" y1="168" x2="310" y2="168" stroke="#fff28f" stroke-width="6" style="opacity: 0.5" />
        <text x="96" y="40" class="tiny" fill="#fff28f">port leg</text>
        <text x="230" y="194" class="tiny" fill="#fff28f">port leg</text>
      </template>
      <template v-else-if="kind === 'corner'">
        <circle cx="178" cy="74" r="22" fill="none" stroke="#a8ff8f" stroke-dasharray="3 3" />
        <line x1="178" y1="74" x2="178" y2="52" stroke="#a8ff8f" />
        <text x="140" y="70" class="tiny" fill="#a8ff8f">R</text>
        <text x="214" y="40" class="tiny" fill="#a8ff8f">corner, radius ≥ R</text>
      </template>
      <template v-else>
        <line x1="200" y1="74" x2="200" y2="146" stroke="#ff8fd6" stroke-width="6" style="opacity: 0.5" />
        <text x="212" y="114" class="tiny" fill="#ff8fd6">jog: between corners that</text>
        <text x="212" y="128" class="tiny" fill="#ff8fd6">turn opposite ways</text>
      </template>
    </g>
  </svg>
</template>

<style scoped>
.concept {
  width: 100%;
  height: 100%;
  display: block;
}
.n {
  font-size: 16px;
  font-weight: 700;
  fill: #fff;
}
.w {
  font-size: 12px;
  fill: #c8cde4;
}
.note {
  font-size: 14px;
  font-weight: 600;
  fill: #fff;
}
.tiny {
  font-size: 12px;
  fill: #fff;
}
</style>
