<script setup lang="ts">
// One term: its visual in the slot, what it means, the terms it builds
// on, and, for the parts of a route, what we want of it.

defineProps<{ term: string; builds?: Array<string>; want?: string; wide?: boolean }>()
</script>

<template>
  <div class="card" :class="{ wide }">
    <div class="visual"><slot /></div>
    <div class="text">
      <div class="head">
        <span class="term">{{ term }}</span>
        <span v-for="b in builds ?? []" :key="b" class="chip">{{ b }}</span>
      </div>
      <div class="def"><slot name="def" /></div>
      <div v-if="want" class="want"><span>we want</span> {{ want }}</div>
    </div>
  </div>
</template>

<style scoped>
.card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
}
.card.wide {
  flex-direction: row;
  gap: 1.5rem;
}
.card.wide .visual {
  flex: 1.5;
}
.card.wide .text {
  flex: 1;
  align-self: center;
}
.visual {
  position: relative;
  flex: 1;
  min-height: 0;
  background: #ffffff05;
  border: 1px solid #ffffff12;
  border-radius: 10px;
  padding: 0.4rem;
}
.head {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.term {
  font-size: 1.15rem;
  font-weight: 700;
  margin-right: 0.3rem;
}
.chip {
  font-size: 0.62rem;
  padding: 0.05rem 0.45rem;
  border-radius: 999px;
  border: 1px solid #ffffff30;
  opacity: 0.7;
}
.chip::before {
  content: '← ';
  opacity: 0.6;
}
.def {
  font-size: 0.82rem;
  line-height: 1.35;
  opacity: 0.9;
  margin-top: 0.2rem;
}
.want {
  font-size: 0.78rem;
  margin-top: 0.35rem;
  color: #a8ff8f;
}
.want span {
  font-size: 0.62rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  opacity: 0.7;
  margin-right: 0.3rem;
}
.visual > :slotted(*) {
  position: absolute;
  inset: 0.4rem;
  width: calc(100% - 0.8rem);
  height: calc(100% - 0.8rem);
}
</style>
