import { type App, type Component, createApp, h, nextTick } from 'vue'
import { GraphicRoot, type GraphicRootProps } from '../../src/components/GraphicRoot.ts'

const mounted: Array<{ app: App; container: HTMLElement }> = []

// Browser specs drive the real components in real Chromium; the geometry
// math is covered by the unit suite, so these helpers only get content
// onto a measured <svg> and settle the ResizeObserver round trip.
export interface Mounted {
  container: HTMLElement
  svg: SVGSVGElement
  app: App
}

export async function mountInRoot(
  content: () => Array<ReturnType<typeof h>>,
  rootProps: GraphicRootProps = {},
  size = { width: 200, height: 100 },
): Promise<Mounted> {
  const container = document.createElement('div')
  container.style.width = `${size.width}px`
  container.style.height = `${size.height}px`
  document.body.append(container)

  const Content: Component = { render: () => h(GraphicRoot, rootProps, { default: content }) }
  const app = createApp(Content)
  app.mount(container)
  mounted.push({ app, container })

  const svg = container.querySelector('svg')
  if (svg === null) {
    throw new Error('GraphicRoot did not render an <svg>')
  }
  // `svg` fills its container (the browser default for a block-level box
  // with width/height 100% is applied here so the observer reports it).
  svg.style.width = '100%'
  svg.style.height = '100%'
  svg.style.display = 'block'

  await settle()
  return { container, svg, app }
}

// ResizeObserver delivers before the next paint; the viewBox then flows back
// through a Vue render. Two frames plus a tick covers the round trip.
export async function settle(): Promise<void> {
  await nextTick()
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await nextTick()
}

export function cleanup(): void {
  for (const { app, container } of mounted.splice(0)) {
    app.unmount()
    container.remove()
  }
}

export function one<T extends Element>(root: ParentNode, selector: string): T {
  const found = root.querySelector<T>(selector)
  if (found === null) {
    throw new Error(`no element matches ${selector}`)
  }
  return found
}
