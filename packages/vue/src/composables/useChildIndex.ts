import {
  type ComponentInternalInstance,
  type InjectionKey,
  type Ref,
  getCurrentInstance,
  inject,
  onUnmounted,
  onUpdated,
  provide,
  ref,
} from 'vue'

type ChildIndexAPI = (vm: ComponentInternalInstance) => Readonly<Ref<number>>

const injection = Symbol.for('ChildIndexRoot') as InjectionKey<ChildIndexAPI>

export function isRecordOrArray(
  input: unknown,
): input is Record<string, unknown> | Array<unknown> {
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

function compareVmNodes(
  a: ComponentInternalInstance,
  b: ComponentInternalInstance,
) {
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
  readonly #storage = new Map<ComponentInternalInstance, Ref<number>>()
  readonly #order: Array<ComponentInternalInstance> = []

  #nextIndex = 0

  insert(vm: ComponentInternalInstance) {
    const index = ref(this.#nextIndex++)
    this.#storage.set(vm, index)
    this.#order.push(vm)

    return index
  }

  remove(vm: ComponentInternalInstance) {
    this.#order.splice(this.#order.indexOf(vm), 1)
    this.#storage.delete(vm)
  }

  update() {
    this.#order.sort(compareVmNodes)

    for (const [index, vm] of this.#order.entries()) {
      const indexRef = this.#storage.get(vm)
      if (indexRef === undefined) {
        throw new Error('No index ref')
      }

      indexRef.value = index
    }
  }
}

export function useIndexParent() {
  const storage = new OrderedInstanceStorage()

  provide(injection, (vm) => {
    onUnmounted(() => {
      storage.remove(vm)
    }, vm)

    return storage.insert(vm)
  })

  onUpdated(() => {
    storage.update()
  })
}

export function useChildIndex(): Readonly<Ref<number>> {
  const register = inject(injection, null)
  const vm = getCurrentInstance()

  if (register === null || vm === null) {
    console.warn('no parent or vm')
    return ref(-1)
  }

  return register(vm)
}
