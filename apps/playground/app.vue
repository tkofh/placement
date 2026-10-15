<template>
  <GraphicRoot width="1000px" height="640px" fit="contain" origin="center">
    <!-- backdrop -->
    <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" />
    <GraphicPath :path="backdropWave" fit="fill" stroke="color(srgb 1 1 1 / 0.04) 70px" />

    <!-- header -->
    <GraphicText left="24px" top="16px" class="title">SPRINGBOARD</GraphicText>
    <GraphicCircle
      v-for="(dot, i) in dots"
      :key="i"
      :left="470 + i * 26"
      :top="27"
      :r="5"
      fill="color(display-p3 0.55 0.95 0.75)"
      :opacity="dot"
    />
    <SpringValue :target="total" :config="{ duration: 900, bounce: 0 }" v-slot="{ value }">
      <GraphicText right="24px" top="16px" class="title">{{ value.toFixed(0) }}</GraphicText>
    </SpringValue>

    <!-- bar chart: composite spring over the data, animated gap, keyed reorder -->
    <GraphicGroup left="24px" top="64px" bottom="24px" width="560px">
      <GraphicRect fill="color(srgb 1 1 1 / 0.035)" r="14px" />
      <GraphicText left="16px" top="12px" class="label">REVENUE / composite spring</GraphicText>
      <GraphicGroup top="44px" bottom="16px" left="16px" right="16px">
        <GraphicGroup
          v-for="column in columns"
          :key="column.month"
          :left="column.left"
          :width="column.width"
          top="0px"
          bottom="0px"
        >
          <FlexLayout flow="column-reverse" align-items="stretch">
            <FlexItem width="100%" height="26px">
              <GraphicRect fill="color(srgb 1 1 1 / 0.08)" r="7px" />
              <GraphicText left="50%" top="50%" origin="center" y="-1.5px" class="label">
                {{ column.month }}
              </GraphicText>
            </FlexItem>
            <FlexItem width="100%" :height="column.height" margin-bottom="6px">
              <GraphicRect :fill="column.color" r="8px" />
              <GraphicText left="50%" top="-20px" origin="center" class="value">
                {{ column.value }}
              </GraphicText>
            </FlexItem>
          </FlexLayout>
        </GraphicGroup>
        <!-- the same composite spring, read as a curve through the bar tops -->
        <GraphicCurve stroke="color(srgb 1 1 1 / 0.5) 1.5px dashed 2 4">
          <GraphicPoint
            v-for="point in overlayPoints"
            :key="point.key"
            :left="point.x"
            :bottom="point.bottom"
          />
        </GraphicCurve>
      </GraphicGroup>
    </GraphicGroup>

    <!-- orbit: a chain of springs following springs -->
    <GraphicGroup left="608px" top="64px" right="24px" height="252px">
      <GraphicRect fill="color(srgb 1 1 1 / 0.035)" r="14px" />
      <GraphicText left="16px" top="12px" class="label">FOLLOW / spring chains</GraphicText>
      <!-- one smooth centripetal Catmull-Rom through the whole chain -->
      <GraphicCurve stroke="color(display-p3 1 0.42 0.75 / 0.55) 2px dashed 5 4">
        <GraphicPoint v-for="(node, i) in nodes" :key="i" :left="node.x" :top="node.y" />
      </GraphicCurve>
      <GraphicCircle
        v-for="(node, i) in nodes"
        :key="i"
        :left="node.x"
        :top="node.y"
        :r="node.r"
        :fill="node.fill"
      />
    </GraphicGroup>

    <!-- dance floor: justify/align driven by raw spring numbers -->
    <GraphicGroup left="608px" right="24px" top="340px" bottom="24px">
      <GraphicRect fill="color(srgb 1 1 1 / 0.035)" r="14px" />
      <GraphicText left="16px" top="12px" class="label">LAYOUT / springy flexbox</GraphicText>
      <GraphicRect
        top="42px"
        bottom="14px"
        left="50%"
        origin="50% 0"
        :aspect-ratio="frameRatio"
        fill="none"
        stroke="color(display-p3 0.55 0.95 0.75 / 0.35) 1.5px dashed 3 5"
        r="10px"
      />
      <FlexLayout
        top="42px"
        bottom="14px"
        left="16px"
        right="16px"
        flow="row nowrap"
        gap="10px"
        :justify-content="dancersX"
        :align-items="dancersY"
      >
        <FlexItem
          v-for="dancer in dancers"
          :key="dancer.fill"
          :width="dancer.size"
          :aspect-ratio="dancer.ratio"
        >
          <GraphicRect :fill="dancer.fill" r="10px" :opacity="dancer.opacity" />
        </FlexItem>
      </FlexLayout>
    </GraphicGroup>
  </GraphicRoot>
</template>

<script setup lang="ts">
import { Cardinal2d } from 'curvy/splines'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'] as const
const PALETTE = [
  'color(display-p3 0.35 0.55 1)',
  'color(display-p3 0.45 0.85 1)',
  'color(display-p3 0.55 0.95 0.75)',
  'color(display-p3 0.95 0.85 0.45)',
  'color(display-p3 1 0.6 0.4)',
  'color(display-p3 1 0.42 0.75)',
  'color(display-p3 0.75 0.55 1)',
]

function roll() {
  return MONTHS.map(() => Math.round(20 + Math.random() * 80))
}

// -- bar chart ---------------------------------------------------------

const barData = ref(roll())
const sorted = ref(false)

// One composite spring animates every bar; retargeting keeps momentum.
// Composite configs take SpringDefinitions (a plain object would be read
// as a per-channel shape mirroring the array).
const bars = useSpring(
  () => barData.value,
  defineSpring({ tension: 170, damping: 24 }),
)
const barGap = useSpring(() => (sorted.value ? 22 : 8), { duration: 800, bounce: 0.45 })

const total = computed(() => barData.value.reduce((sum, value) => sum + value, 0))

// Columns keep a fixed slot in the template; sorting only changes each
// column's target rank. A second composite spring animates the ranks, so a
// re-sort glides the columns into place instead of swapping keyed VNodes.
const rankTargets = computed(() => {
  const indices = MONTHS.map((_, i) => i)
  if (sorted.value) {
    indices.sort((a, b) => (barData.value[b] ?? 0) - (barData.value[a] ?? 0))
  }
  const ranks = indices.map(() => 0)
  for (const [rank, i] of indices.entries()) {
    ranks[i] = rank
  }
  return ranks
})
const ranks = useSpring(() => rankTargets.value, defineSpring({ tension: 120, damping: 18 }))

// The chart is 528px wide inside its panel; columns share it with 6 gaps.
const columns = computed(() => {
  const gap = barGap.value
  const width = (528 - 6 * gap) / 7
  return MONTHS.map((month, i) => ({
    month,
    color: PALETTE[i]!,
    height: (bars.value[i] ?? 0) * 4,
    value: Math.round(bars.value[i] ?? 0),
    left: (ranks.value[i] ?? i) * (width + gap),
    width,
  }))
})

// Curve overlay control points: the column centers and bar tops, left to
// right in their current (animated) positions.
const overlayPoints = computed(() =>
  columns.value
    .map((column) => ({
      key: column.month,
      x: column.left + column.width / 2,
      bottom: 32 + column.height,
    }))
    .sort((a, b) => a.x - b.x),
)

// -- orbit chain -------------------------------------------------------

const angle = ref(0)
const headX = useSpring(() => 184 + 132 * Math.cos(angle.value), {
  tension: 180,
  damping: 12,
  mass: 1,
})
const headY = useSpring(() => 136 + 74 * Math.sin(1.3 * angle.value), {
  tension: 180,
  damping: 12,
  mass: 1,
})

// Each follower springs toward the previous spring's live value — the
// subscription bypasses Vue reactivity entirely.
const chainX = [headX]
const chainY = [headY]
for (let i = 0; i < 4; i++) {
  chainX.push(useSpring(chainX[i]!, { duration: 350 + i * 140, bounce: 0.2 }))
  chainY.push(useSpring(chainY[i]!, { duration: 350 + i * 140, bounce: 0.2 }))
}

const nodes = computed(() =>
  chainX.map((x, i) => ({
    x: x.value,
    y: chainY[i]!.value,
    r:
      i === 0
        ? 10 + Math.min(14, Math.hypot(headX.velocity.value, headY.velocity.value) * 0.018)
        : 9 - i * 1.5,
    fill: PALETTE[(i * 2 + 4) % PALETTE.length]!,
  })),
)

// -- dance floor -------------------------------------------------------

const corner = ref(0)
const CORNERS = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
  [0.5, 0.5],
] as const

const dancersX = useSpring(() => CORNERS[corner.value]![0], { tension: 120, damping: 13 })
const dancersY = useSpring(() => CORNERS[corner.value]![1], { tension: 120, damping: 13 })
const frameRatio = useSpring(() => (corner.value % 2 === 0 ? 0.62 : 1.62), {
  duration: 1200,
  bounce: 0.25,
})

const dancerPulse = useSpring(() => (corner.value % 2) * 0.5, { duration: 700, bounce: 0.6 })
const dancers = computed(() => [
  { fill: PALETTE[0]!, size: 52 + dancerPulse.value * 24, ratio: 1, opacity: 0.95 },
  { fill: PALETTE[5]!, size: 40, ratio: 0.75, opacity: 0.6 + dancerPulse.value * 0.4 },
  { fill: PALETTE[3]!, size: 64 - dancerPulse.value * 24, ratio: 1.5, opacity: 0.8 },
])

// -- backdrop ----------------------------------------------------------

// A normalized wave, stretched across the whole scene by fit="fill".
const backdropWave = Cardinal2d.toPath(
  Cardinal2d.withDuplicatedEndpoints(
    Cardinal2d.fromTuples([
      [0, 0.6],
      [0.2, 0.35],
      [0.45, 0.7],
      [0.7, 0.3],
      [1, 0.55],
    ]),
  ),
)

// -- header dots -------------------------------------------------------

const pulse = ref(0)
const dotPulse = useSpring(() => pulse.value, { duration: 650, bounce: 0.55 })
const dots = computed(() => [
  0.25 + 0.75 * dotPulse.value,
  1 - 0.75 * dotPulse.value,
  0.25 + 1.5 * Math.abs(0.5 - dotPulse.value),
])

// -- conductor ---------------------------------------------------------

onMounted(() => {
  const timers = [
    setInterval(() => {
      barData.value = roll()
    }, 3400),
    setInterval(() => {
      sorted.value = !sorted.value
    }, 6800),
    setInterval(() => {
      angle.value += 2.4
    }, 900),
    setInterval(() => {
      corner.value = (corner.value + 1) % CORNERS.length
    }, 2200),
    setInterval(() => {
      pulse.value = pulse.value === 0 ? 1 : 0
    }, 1300),
  ]

  onBeforeUnmount(() => {
    for (const timer of timers) {
      clearInterval(timer)
    }
  })
})
</script>

<style>
* {
  box-sizing: border-box;
  margin: 0;
}
svg,
body,
html {
  display: block;
  width: 100dvw;
  height: 100dvh;
  background: color(display-p3 0.045 0.055 0.1);
}
svg text {
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  fill: color(display-p3 0.88 0.9 0.96);
}
svg text.title {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.08em;
}
svg text.label {
  font-size: 10px;
  letter-spacing: 0.12em;
  opacity: 0.55;
}
svg text.value {
  font-size: 11px;
  font-weight: 600;
}
</style>
