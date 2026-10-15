import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

const chaiConfig = { truncateThreshold: 0 }

// Firefox runs on CI, or locally with PLACEMENT_FIREFOX=1. The Firefox build
// of Playwright does not launch on every macOS version, and a browser that
// cannot start fails the whole local `pnpm test`.
const browsers = ['chromium', 'webkit'] as const
const withFirefox =
  process.env['CI'] !== undefined || process.env['PLACEMENT_FIREFOX'] !== undefined
const instances = [...browsers, ...(withFirefox ? (['firefox'] as const) : [])].map((browser) => ({
  browser,
}))

// Two projects. The fast unit suite runs against the object-tree renderer in
// node. `test/browser` mounts the real components in headless Chromium to
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
            instances,
          },
        },
      },
    ],
  },
})
