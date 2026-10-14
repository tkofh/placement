import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const chaiConfig = { truncateThreshold: 0 }

// Two projects: the fast unit suite runs against the object-tree renderer in
// node; `test/browser` mounts the real components in headless Chromium, to
// cover what a fake host cannot (SVG namespaces, attribute vs property
// patching, ResizeObserver, real geometry).
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          chaiConfig,
          include: ['test/**/*.spec.ts'],
          exclude: ['test/browser/**'],
        },
      },
      {
        test: {
          name: 'browser',
          chaiConfig,
          include: ['test/browser/**/*.spec.ts'],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
