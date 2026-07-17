import {
  type ComponentInternalInstance,
  type InjectionKey,
  type Ref,
  customRef,
  getCurrentInstance,
  inject,
  onMounted,
  onUnmounted,
  onUpdated,
  provide,
  ref,
} from 'vue'

type ChildIndexAPI = (vm: ComponentInternalInstance) => Readonly<Ref<number>>

const injection = Symbol.for('placement/child-index') as InjectionKey<ChildIndexAPI>

function isRecordOrArray(input: unknown): input is Record<string, unknown> | Array<unknown> {
  return typeof input === 'object' && input !== null
}
function isNode(node: unknown): node is Node {
  return isRecordOrArray(node) && 'nodeType' in node
}
function getVmNode(vm: ComponentInternalInstance) {
  if (!isNode(vm.vnode.el)) {
    throw new Error('No vnode.el')
  }

  return vm.vnode.el
}

function compareVmNodes(a: ComponentInternalInstance, b: ComponentInternalInstance) {
  const aNode = getVmNode(a)
  const bNode = getVmNode(b)

  const comparison = bNode.compareDocumentPosition(aNode)

  if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
    return -1
  }
  if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
    return 1
  }

  throw new Error('non-comparable nodes')
}

class OrderedInstanceStorage {
  readonly storage = new Map<ComponentInternalInstance, Ref<number>>()
  readonly order: Array<ComponentInternalInstance> = []
  readonly trigger: (value: number) => void

  constructor(trigger: (value: number) => void) {
    this.trigger = trigger
  }

  insert(vm: ComponentInternalInstance) {
    // Append at the current end: indexes stay contiguous because `remove`
    // compacts the survivors. DOM order is unknowable here (the vm has no
    // element until it mounts), so `update` re-sorts on the child's mount.
    const index = ref(this.order.length)
    this.storage.set(vm, index)
    this.order.push(vm)

    this.trigger(this.order.length)

    return index
  }

  remove(vm: ComponentInternalInstance) {
    const index = this.storage.get(vm)
    const at = this.order.indexOf(vm)

    if (at !== -1) {
      this.order.splice(at, 1)
    }
    this.storage.delete(vm)

    // Flag the removed child first so its consumers read -1, then re-sort and
    // compact the survivors: a child unmounting behind an intermediate
    // component boundary never re-renders the parent, so waiting for the
    // parent's onUpdated would leave every index permanently stale.
    if (index !== undefined) {
      index.value = -1
    }
    this.update()

    this.trigger(this.order.length)
  }

  update() {
    this.order.sort(compareVmNodes)

    for (const [index, vm] of this.order.entries()) {
      const indexRef = this.storage.get(vm)
      if (indexRef === undefined) {
        throw new Error('No index ref')
      }

      indexRef.value = index
    }
  }
}

export function useIndexParent() {
  let storage: OrderedInstanceStorage
  const length = customRef<number>((track, trigger) => {
    storage = new OrderedInstanceStorage(trigger)

    return {
      get() {
        track()
        return storage.order.length
      },
      set(newValue) {
        if (newValue < storage.order.length) {
          const removed = storage.order.splice(newValue)
          for (const vm of removed) {
            storage.storage.delete(vm)
          }
        }
      },
    }
  })

  provide(injection, (vm) => {
    // Re-sort on the child's own mount: a child (re)mounted behind an
    // intermediate component boundary never re-renders the parent, so the
    // parent's onUpdated below cannot be relied on to assign its index.
    onMounted(() => {
      storage.update()
    }, vm)

    onUnmounted(() => {
      storage.remove(vm)
    }, vm)

    return storage.insert(vm)
  })

  onUpdated(() => {
    storage.update()
  })

  return length
}

export function useChildIndex(): Readonly<Ref<number>> {
  const register = inject(injection, null)
  const vm = getCurrentInstance()

  if (register === null || vm === null) {
    console.warn('no parent or no vm')
    return ref(-1)
  }

  return register(vm)
}
