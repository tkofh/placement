<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { FILLS, type SearchRun, type XY, boundsOf, sceneOf } from '../utils/scene'

// Dijkstra and A* side by side on one scene's visibility graph, on one
// clock: step `k` has settled `k` nodes in each search (or all it needed).
// The frontier is every node a search has reached but not settled.

const props = withDefaults(defineProps<{ scene?: string; speed?: number }>(), {
  scene: 'toy',
  speed: 90,
})

const data = computed(() => sceneOf(props.scene))
const search = computed(() => data.value.search!)
const searches = computed(() => [
  { name: 'Dijkstra', note: 'f = g', run: search.value.dijkstra },
  { name: 'A*', note: 'f = g + h', run: search.value.astar },
])
const settles = (run: SearchRun) => run.events.filter(([kind]) => kind === 1).length
const total = computed(() => Math.max(...searches.value.map(({ run }) => settles(run))))

const step = ref(0)
const playing = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

function stop() {
  playing.value = false
  clearInterval(timer)
}
function play() {
  if (playing.value) return stop()
  if (step.value >= total.value) step.value = 0
  playing.value = true
  timer = setInterval(() => {
    if (step.value >= total.value) return stop()
    step.value++
  }, props.speed)
}
onBeforeUnmount(stop)

function stateAt(run: SearchRun, k: number) {
  const frontier = new Set<number>()
  const settled = new Set<number>()
  const tree: Array<[number, number]> = []
  let count = 0
  let last = -1
  for (const [kind, node, parent] of run.events) {
    if (kind === 1) {
      if (count >= k) break
      count++
      frontier.delete(node)
      settled.add(node)
      last = node
      if (parent >= 0) tree.push([parent, node])
    } else if (!settled.has(node)) {
      frontier.add(node)
    }
  }
  const done = count === settles(run)
  return { frontier, settled, tree, done, count, last }
}

const runs = computed(() =>
  searches.value.map((entry) => ({ ...entry, s: stateAt(entry.run, step.value) })),
)

const nodes = computed(() => data.value.graph.nodes)
const box = computed(() => boundsOf(data.value))
const viewBox = computed(
  () => `${box.value.x} ${box.value.y} ${box.value.width} ${box.value.height}`,
)
const at = (n: number) => nodes.value[n] as XY
const line = (list: Array<number>) =>
  list.map((n, k) => `${k ? 'L' : 'M'}${at(n)[0]} ${at(n)[1]}`).join(' ')
</script>

<template>
  <div class="player">
    <div class="panels">
      <div v-for="{ name, note, run, s } in runs" :key="name" class="panel">
        <div class="head">
          <span class="name">{{ name }}</span>
          <code>{{ note }}</code>
          <span class="count">
            settled {{ s.count }}
            <template v-if="s.done">
              nodes ({{ run.states }} states) · cost {{ run.cost }}</template
            >
          </span>
        </div>
        <svg :viewBox="viewBox">
          <g stroke="#6f8cff" stroke-width="0.6" style="opacity: 0.35">
            <line
              v-for="([a, b], k) in data.graph.edges"
              :key="k"
              :x1="at(a)[0]"
              :y1="at(a)[1]"
              :x2="at(b)[0]"
              :y2="at(b)[1]"
            />
          </g>
          <rect
            v-for="r in data.rects"
            :key="r.id"
            :x="r.x"
            :y="r.y"
            :width="r.width"
            :height="r.height"
            :rx="r.kind === 'wall' ? 2 : 8"
            :fill="FILLS[r.kind] ?? FILLS.node"
            stroke="#ffffff30"
          />
          <text
            v-for="r in data.rects"
            :key="`t${r.id}`"
            :x="r.x + r.width / 2"
            :y="r.y + r.height / 2 + 5"
            text-anchor="middle"
            class="label"
          >
            {{ r.label }}
          </text>
          <g stroke="#a8ff8f" stroke-width="1.2" style="opacity: 0.6">
            <line
              v-for="([a, b], k) in s.tree"
              :key="k"
              :x1="at(a)[0]"
              :y1="at(a)[1]"
              :x2="at(b)[0]"
              :y2="at(b)[1]"
            />
          </g>
          <circle
            v-for="n in s.settled"
            :key="`s${n}`"
            :cx="at(n)[0]"
            :cy="at(n)[1]"
            r="3.2"
            fill="#a8ff8f"
          />
          <circle
            v-for="n in s.frontier"
            :key="`f${n}`"
            :cx="at(n)[0]"
            :cy="at(n)[1]"
            r="3.6"
            fill="none"
            stroke="#ffb38f"
            stroke-width="1.4"
          />
          <circle
            v-if="s.last >= 0 && !s.done"
            :cx="at(s.last)[0]"
            :cy="at(s.last)[1]"
            r="7"
            fill="none"
            stroke="#fff"
            stroke-width="1.2"
          />
          <path
            v-if="s.done"
            :d="line(run.path)"
            fill="none"
            stroke="#fff28f"
            stroke-width="3"
            stroke-linejoin="round"
          />
          <circle :cx="at(search.start)[0]" :cy="at(search.start)[1]" r="5" fill="#fff28f" />
          <circle :cx="at(search.goal)[0]" :cy="at(search.goal)[1]" r="5" fill="#ff8fd6" />
        </svg>
      </div>
    </div>
    <div class="controls">
      <button @click="play">{{ playing ? 'pause' : 'play' }}</button>
      <input v-model.number="step" type="range" min="0" :max="total" @input="stop" />
      <span class="legend">
        <i class="dot settled" /> settled <i class="dot frontier" /> frontier
        <i class="dot path" /> path · bend cost {{ search.bendCost }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.player {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.panels {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
}
.panel svg {
  width: 100%;
  display: block;
  background: #0b0e19;
  border-radius: 8px;
}
.head {
  display: flex;
  gap: 0.6rem;
  align-items: baseline;
  font-size: 0.85rem;
  margin-bottom: 0.3rem;
}
.name {
  font-weight: 700;
}
.count {
  margin-left: auto;
  opacity: 0.7;
  font-variant-numeric: tabular-nums;
}
.label {
  font-size: 13px;
  font-weight: 600;
  fill: #fff;
}
.controls {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  font-size: 0.8rem;
}
.controls input {
  flex: 1;
}
.controls button {
  padding: 0.15rem 0.8rem;
  border: 1px solid #ffffff40;
  border-radius: 6px;
}
.legend {
  opacity: 0.75;
}
.dot {
  display: inline-block;
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 50%;
  margin: 0 0.15rem 0 0.5rem;
  vertical-align: middle;
}
.settled {
  background: #a8ff8f;
}
.frontier {
  border: 1.5px solid #ffb38f;
}
.path {
  background: #fff28f;
  border-radius: 2px;
  height: 0.2rem;
}
</style>
