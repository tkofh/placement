<script setup lang="ts">
import { computed } from 'vue'

// A small weighted graph, and Dijkstra on it from S, one settle per step.
// Step 0 shows the graph with every distance unknown; each step after
// settles the cheapest frontier node and relaxes its edges; the last step
// draws the shortest path to T. `plain` draws the graph alone.

const props = withDefaults(defineProps<{ step?: number; plain?: boolean }>(), {
  step: 0,
  plain: false,
})

const NODES: Record<string, [number, number]> = {
  S: [60, 160],
  A: [210, 60],
  B: [210, 260],
  C: [380, 60],
  D: [380, 260],
  T: [530, 160],
}
const EDGES: Array<[string, string, number]> = [
  ['S', 'A', 4],
  ['S', 'B', 2],
  ['A', 'B', 1],
  ['A', 'C', 5],
  ['B', 'D', 8],
  ['B', 'C', 9],
  ['C', 'D', 2],
  ['C', 'T', 7],
  ['D', 'T', 3],
]

interface Frame {
  dist: Record<string, number>
  parent: Record<string, string | undefined>
  settled: Set<string>
  current: string | undefined
  relaxed: Array<string>
}

// Every frame of the run, the first before anything settles.
const frames = computed(() => {
  const dist: Record<string, number> = Object.fromEntries(
    Object.keys(NODES).map((n) => [n, Infinity]),
  )
  const parent: Record<string, string | undefined> = {}
  const settled = new Set<string>()
  dist.S = 0
  const list: Array<Frame> = [
    {
      dist: { ...dist },
      parent: { ...parent },
      settled: new Set(),
      current: undefined,
      relaxed: [],
    },
  ]
  while (settled.size < Object.keys(NODES).length) {
    const next = Object.keys(NODES)
      .filter((n) => !settled.has(n))
      .sort((a, b) => (dist[a] as number) - (dist[b] as number))[0] as string
    settled.add(next)
    const relaxed: Array<string> = []
    for (const [a, b, w] of EDGES) {
      const other = a === next ? b : b === next ? a : undefined
      if (other === undefined || settled.has(other)) continue
      if ((dist[next] as number) + w < (dist[other] as number)) {
        dist[other] = (dist[next] as number) + w
        parent[other] = next
        relaxed.push(`${a}${b}`)
      }
    }
    list.push({
      dist: { ...dist },
      parent: { ...parent },
      settled: new Set(settled),
      current: next,
      relaxed,
    })
  }
  return list
})

const frame = computed(() => frames.value[Math.min(props.step, frames.value.length - 1)] as Frame)
const finished = computed(() => props.step >= frames.value.length)

const onTree = (a: string, b: string) => frame.value.parent[b] === a || frame.value.parent[a] === b
const onPath = computed(() => {
  const set = new Set<string>()
  if (!finished.value) return set
  for (let n: string | undefined = 'T'; n && frame.value.parent[n]; n = frame.value.parent[n]) {
    const p = frame.value.parent[n] as string
    set.add(`${p}${n}`).add(`${n}${p}`)
  }
  return set
})
const fmt = (d: number) => (Number.isFinite(d) ? String(d) : '∞')
const mid = (a: string, b: string) => {
  const [ax, ay] = NODES[a] as [number, number]
  const [bx, by] = NODES[b] as [number, number]
  return [(ax + bx) / 2, (ay + by) / 2]
}
const edgeColor = (a: string, b: string) => {
  if (props.plain) return '#8a93b8'
  if (onPath.value.has(`${a}${b}`)) return '#fff28f'
  if (frame.value.relaxed.includes(`${a}${b}`)) return '#ffb38f'
  if (onTree(a, b)) return '#a8ff8f'
  return '#4b5270'
}
const nodeFill = (n: string) => {
  if (props.plain) return '#243258'
  if (frame.value.current === n && !finished.value) return '#3f6b3a'
  if (frame.value.settled.has(n)) return '#2c4a2a'
  if (Number.isFinite(frame.value.dist[n] as number)) return '#5a3b22'
  return '#243258'
}
</script>

<template>
  <svg viewBox="0 0 600 330" class="graph">
    <g v-for="[a, b, w] in EDGES" :key="`${a}${b}`">
      <line
        :x1="NODES[a]![0]"
        :y1="NODES[a]![1]"
        :x2="NODES[b]![0]"
        :y2="NODES[b]![1]"
        :stroke="edgeColor(a, b)"
        :stroke-width="onPath.has(`${a}${b}`) ? 4 : 2"
      />
      <circle :cx="mid(a, b)[0]" :cy="mid(a, b)[1]" r="11" fill="#0b0e19" />
      <text :x="mid(a, b)[0]" :y="mid(a, b)[1] + 5" text-anchor="middle" class="weight">
        {{ w }}
      </text>
    </g>
    <g v-for="(xy, n) in NODES" :key="n">
      <circle
        :cx="xy[0]"
        :cy="xy[1]"
        r="24"
        :fill="nodeFill(n)"
        stroke="#ffffff60"
        stroke-width="1.5"
      />
      <text :x="xy[0]" :y="xy[1] + 6" text-anchor="middle" class="name">{{ n }}</text>
      <text
        v-if="!plain"
        :x="xy[0]"
        :y="xy[1] + (xy[1] < 160 ? -34 : 48)"
        text-anchor="middle"
        class="dist"
      >
        {{ fmt(frame.dist[n]!) }}
      </text>
    </g>
  </svg>
</template>

<style scoped>
.graph {
  width: 100%;
  height: 100%;
}
.name {
  font-size: 18px;
  font-weight: 700;
  fill: #fff;
}
.weight {
  font-size: 13px;
  fill: #c8cde4;
}
.dist {
  font-size: 15px;
  font-weight: 600;
  fill: #ffb38f;
  font-variant-numeric: tabular-nums;
}
</style>
