<template>
  <GraphicRoot width="1000px" height="640px" fit="contain" origin="center">
    <!-- backdrop -->
    <GraphicRect fill="color(display-p3 0.045 0.055 0.1)" />

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
      <FlexLayout
        top="44px"
        bottom="16px"
        left="16px"
        right="16px"
        flow="row nowrap"
        align-items="end"
        :gap="barGap"
      >
        <FlexItem v-for="bar in orderedBars" :key="bar.month" height="100%" grow="1">
          <FlexLayout flow="column-reverse" align-items="stretch">
            <FlexItem width="100%" height="26px">
              <GraphicRect fill="color(srgb 1 1 1 / 0.08)" r="7px" />
              <GraphicText left="50%" top="50%" origin="center" y="-1.5px" class="label">
                {{ bar.month }}
              </GraphicText>
            </FlexItem>
            <FlexItem width="100%" :height="bar.height" margin-bottom="6px">
              <GraphicRect :fill="bar.color" r="8px" />
              <GraphicText left="50%" top="-20px" origin="center" class="value">
                {{ bar.value }}
              </GraphicText>
            </FlexItem>
          </FlexLayout>
        </FlexItem>
      </FlexLayout>
    </GraphicGroup>

    <!-- orbit: a chain of springs following springs -->
    <GraphicGroup left="608px" top="64px" right="24px" height="252px">
      <GraphicRect fill="color(srgb 1 1 1 / 0.035)" r="14px" />
      <GraphicText left="16px" top="12px" class="label">FOLLOW / spring chains</GraphicText>
      <GraphicLine
        v-for="(link, i) in links"
        :key="i"
        stroke="color(display-p3 1 0.42 0.75 / 0.55) 2px dashed 5 4"
      >
        <GraphicPoint :left="link.x1" :top="link.y1" />
        <GraphicPoint :left="link.x2" :top="link.y2" />
      </GraphicLine>
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

// Sorting reorders the keyed VNodes; the children registry keeps the
// flexbox order in sync with the template order.
const orderedBars = computed(() => {
  const indices = MONTHS.map((_, i) => i)
  if (sorted.value) {
    indices.sort((a, b) => (barData.value[b] ?? 0) - (barData.value[a] ?? 0))
  }
  return indices.map((i) => ({
    month: MONTHS[i]!,
    color: PALETTE[i]!,
    height: (bars.value[i] ?? 0) * 4,
    value: Math.round(bars.value[i] ?? 0),
  }))
})

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

const links = computed(() =>
  nodes.value.slice(1).map((node, i) => ({
    x1: nodes.value[i]!.x,
    y1: nodes.value[i]!.y,
    x2: node.x,
    y2: node.y,
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
