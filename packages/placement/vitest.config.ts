import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    chaiConfig: {
      truncateThreshold: 0,
    },
    typecheck: {
      enabled: true,
      include: ['test/**/*.test-d.ts'],
    },
  },
})
