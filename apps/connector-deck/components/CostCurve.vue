<script setup lang="ts">
import { computed } from 'vue'

// Two price curves of the search, drawn from the formulas in
// `internal/graph/search.ts`:
// - `jog`: what a Z costs by the length L of its jog, with corners of
//   radius R: two turns in full at any length (the old cliff), or in
//   proportion up to 2R (now).
// - `congestion`: what a pixel of length costs by how many routes over
//   capacity its channel is, at each round's pressure.

const props = withDefaults(
  defineProps<{ kind?: 'jog' | 'congestion'; bend?: number; radius?: number }>(),
  {
    kind: 'jog',
    bend: 48,
    radius: 16,
  },
)

const W = 520
const H = 260
const M = { l: 56, r: 16, t: 20, b: 44 }
const iw = W - M.l - M.r
const ih = H - M.t - M.b

const jog = computed(() => {
  const maxL = 3 * props.radius
  const maxY = 2.2 * props.bend
  const x = (l: number) => M.l + (l / maxL) * iw
  const y = (c: number) => M.t + ih - (c / maxY) * ih
  const old = `M${x(0)} ${y(0)} L${x(0)} ${y(2 * props.bend)} L${x(maxL)} ${y(2 * props.bend)}`
  const now = `M${x(0)} ${y(0)} L${x(2 * props.radius)} ${y(2 * props.bend)} L${x(maxL)} ${y(2 * props.bend)}`
  return { x, y, old, now, maxL, maxY }
})

const congestion = computed(() => {
  const maxO = 2
  const maxY = 9
  const x = (o: number) => M.l + (o / maxO) * iw
  const y = (c: number) => M.t + ih - (c / maxY) * ih
  const lines = [0.5, 1, 2, 4].map((p) => ({
    p,
    d: `M${x(0)} ${y(1)} L${x(maxO)} ${y(1 + p * maxO)}`,
    end: [x(Math.min(maxO, (maxY - 1) / p)), y(Math.min(1 + p * maxO, maxY))] as const,
  }))
  return { x, y, lines, maxO, maxY }
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="curve">
    <g v-if="kind === 'jog'">
      <line :x1="M.l" :y1="M.t + ih" :x2="M.l + iw" :y2="M.t + ih" class="axis" />
      <line :x1="M.l" :y1="M.t" :x2="M.l" :y2="M.t + ih" class="axis" />
      <line
        :x1="jog.x(2 * radius)"
        :y1="M.t"
        :x2="jog.x(2 * radius)"
        :y2="M.t + ih"
        class="guide"
      />
      <text :x="jog.x(2 * radius)" :y="M.t + ih + 18" text-anchor="middle" class="tick">2R</text>
      <text :x="jog.x(0)" :y="M.t + ih + 18" text-anchor="middle" class="tick">0</text>
      <text :x="M.l - 8" :y="jog.y(2 * bend) + 4" text-anchor="end" class="tick">2·bend</text>
      <path :d="jog.old" fill="none" stroke="#ff5f6d" stroke-width="2.5" stroke-dasharray="6 4" />
      <path :d="jog.now" fill="none" stroke="#a8ff8f" stroke-width="3" />
      <text :x="jog.x(0.15 * radius)" :y="jog.y(2 * bend) - 10" class="tick" fill="#ff5f6d">
        before: a 0.5px jog = two bends
      </text>
      <text :x="jog.x(1.05 * radius)" :y="jog.y(0.7 * bend)" class="tick" fill="#a8ff8f">
        now: L / 2R of two bends
      </text>
      <text :x="M.l + iw / 2" :y="H - 6" text-anchor="middle" class="tick">jog length L</text>
    </g>
    <g v-else>
      <line :x1="M.l" :y1="M.t + ih" :x2="M.l + iw" :y2="M.t + ih" class="axis" />
      <line :x1="M.l" :y1="M.t" :x2="M.l" :y2="M.t + ih" class="axis" />
      <text :x="M.l - 8" :y="congestion.y(1) + 4" text-anchor="end" class="tick">1×</text>
      <text :x="M.l - 8" :y="congestion.y(5) + 4" text-anchor="end" class="tick">5×</text>
      <text
        v-for="o in [0, 1, 2]"
        :key="o"
        :x="congestion.x(o)"
        :y="M.t + ih + 18"
        text-anchor="middle"
        class="tick"
      >
        {{ o }}
      </text>
      <path
        v-for="l in congestion.lines"
        :key="l.p"
        :d="l.d"
        fill="none"
        stroke="#8fb8ff"
        :stroke-width="1 + l.p / 2"
        :style="{ opacity: 0.4 + l.p / 8 }"
      />
      <text
        v-for="l in congestion.lines"
        :key="`t${l.p}`"
        :x="l.end[0] - 4"
        :y="l.end[1] - 6"
        text-anchor="end"
        class="tick"
        fill="#8fb8ff"
      >
        pressure {{ l.p }}
      </text>
      <text :x="M.l + iw / 2" :y="H - 6" text-anchor="middle" class="tick">
        overflow (routes over capacity)
      </text>
    </g>
  </svg>
</template>

<style scoped>
.curve {
  width: 100%;
  height: 100%;
}
.axis {
  stroke: #ffffff70;
}
.guide {
  stroke: #ffffff30;
  stroke-dasharray: 3 3;
}
.tick {
  font-size: 12px;
  fill: #ffffffb0;
}
</style>
