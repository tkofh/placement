import {
  type InjectionKey,
  type Ref,
  customRef,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  provide,
  shallowRef,
  watch,
} from 'vue'

interface ChildIndexAPI {
  register: (node: Ref<Node | null>) => Readonly<Ref<number>>
  remove: (index: number) => void
}

interface IndexInternalState {
  trigger: () => void
  value: number
}

const ParentSymbol = Symbol('Parent') as InjectionKey<ChildIndexAPI>

function useVmEl() {
  const vm = getCurrentInstance()

  if (vm == null) {
    throw new Error('useVmEl must be called within a setup function')
  }

  const el = shallowRef<Node | null>(null)

  onMounted(() => {
    el.value = vm.vnode.el as Node
  })
  onBeforeUpdate(() => {
    el.value = vm.vnode.el as Node
  })
  onBeforeUnmount(() => {
    el.value = null
  })

  return el
}

function getNodeIndex(node: Node, orderedNodes: Array<Node>): number {
  for (const [index, orderedNode] of orderedNodes.entries()) {
    if (
      orderedNode.compareDocumentPosition(node) &
      Node.DOCUMENT_POSITION_PRECEDING
    ) {
      return index
    }
  }
  return orderedNodes.length
}

export function registerIndexParent() {
  const vm = getCurrentInstance()

  if (vm == null) {
    throw new Error(
      'registerIndexParent must be called within a setup function',
    )
  }

  const triggers = new Map<Node, IndexInternalState>()

  let register: (node: Ref<Node | null>) => Readonly<Ref<number>>
  let remove: (index: number) => void

  let autoIndex = 0

  if (import.meta.server) {
    register = () => {
      return shallowRef(autoIndex++) as Readonly<Ref<number>>
    }
    remove = () => {}
  } else {
    let isMounted = false
    onMounted(() => {
      isMounted = true
    })

    const orderedNodes: Array<Node> = []

    const shiftIndexes = (index: number, delta: number) => {
      for (const node of orderedNodes.slice(index + 1)) {
        const state = triggers.get(node)
        if (state == null) {
          continue
        }
        state.value += delta
        state.trigger()
      }
    }

    const insert = (node: Node) => {
      if (isMounted) {
        const state = triggers.get(node)
        if (state == null) {
          return
        }

        const index = getNodeIndex(node, orderedNodes)

        orderedNodes.splice(index, 0, node)
        if (index < orderedNodes.length - 1 && !isMounted) {
          shiftIndexes(index, 1)
        }

        state.value = index
        state.trigger()
      } else {
        orderedNodes.push(node)
      }
    }
    remove = (index: number) => {
      orderedNodes.splice(index, 1)
      if (index < orderedNodes.length) {
        shiftIndexes(index, -1)
      }
    }

    register = (node: Ref<Node | null>) => {
      return customRef((track, trigger) => {
        const state: IndexInternalState = {
          trigger,
          value: isMounted ? -1 : autoIndex++,
        }
        const stop = watch(
          node,
          (node) => {
            if (node) {
              triggers.set(node, state)
              insert(node)
              stop()
            }
          },
          { immediate: true },
        )

        return {
          get() {
            track()
            return state.value
          },
          set() {},
        }
      })
    }
  }

  provide(ParentSymbol, { register, remove })
}

export function useChildIndex() {
  const el = useVmEl()

  const parent = inject(ParentSymbol, null)

  if (parent === null) {
    throw new Error('No parent index found')
  }

  const index = parent.register(el)
  onBeforeUnmount(() => {
    parent.remove(index.value)
  })

  return index
}
