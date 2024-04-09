import {
  type ComponentInternalInstance,
  type InjectionKey,
  type Ref,
  type VNode,
  customRef,
  getCurrentInstance,
  inject,
  onBeforeUnmount,
  provide,
} from 'vue'

interface ChildIndexAPI {
  register: (uid: number) => Readonly<Ref<number>>
  remove: (uid: number) => void
}

const ParentSymbol = Symbol('Parent') as InjectionKey<ChildIndexAPI>

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: necessary efficient tree traversal
function updateIndexes(
  states: Map<number, IndexInternalState>,
  vm: ComponentInternalInstance,
) {
  const subtree = vm.subTree

  const found = new Set<number>()

  let index = 0

  const vnodes: Array<VNode> = [subtree]
  while (vnodes.length > 0) {
    const vnode = vnodes.pop() as VNode

    if (vnode.component !== null) {
      const uid = vnode.component.uid
      if (found.has(uid)) {
        continue
      }

      const state = states.get(uid)
      if (state == null) {
        continue
      }

      found.add(uid)
      if (state.value !== index) {
        state.value = index
        state.trigger()
      }
      index++
    }

    if (found.size === states.size) {
      break
    }

    if (Array.isArray(vnode.children)) {
      for (const child of vnode.children.flat()) {
        if (
          typeof child === 'object' &&
          child != null &&
          !Array.isArray(child)
        ) {
          vnodes.unshift(child)
        }
      }
    }
  }

  for (const [uid, state] of states) {
    if (!found.has(uid)) {
      state.value = -1
      state.trigger()
      states.delete(uid)
    }
  }
}

interface IndexInternalState {
  trigger: () => void
  value: number
}

export function registerIndexParent() {
  const vm = getCurrentInstance()

  if (vm == null) {
    throw new Error(
      'registerIndexParent must be called within a setup function',
    )
  }

  const triggers = new Map<number, IndexInternalState>()

  const register = (uid: number) => {
    const index = customRef((track, trigger) => {
      const state: IndexInternalState = {
        trigger,
        value: -1,
      }
      triggers.set(uid, state)

      return {
        get() {
          track()
          return state.value
        },
        set() {
          throw new Error('Readonly')
        },
      }
    })

    updateIndexes(triggers, vm)

    return index
  }

  const remove = (uid: number) => {
    const removed = triggers.get(uid)
    if (removed == null) {
      return
    }

    triggers.delete(uid)

    for (const state of triggers.values()) {
      if (state.value > removed.value) {
        state.value--
        state.trigger()
      }
    }
  }

  provide(ParentSymbol, { register, remove })
}

export function useChildIndex() {
  const vm = getCurrentInstance()

  if (vm == null) {
    throw new Error('useChildIndex must be called within a setup function')
  }

  const api = inject(ParentSymbol, null)

  if (api === null) {
    throw new Error('No parent index found')
  }

  const uid = vm.uid
  const index = api.register(uid)

  onBeforeUnmount(() => {
    api.remove(uid)
  })

  return index
}
