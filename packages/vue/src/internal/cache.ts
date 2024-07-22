// an LRU cache implementation

class Node<K, V> {
  key: K
  value: V
  prev: Node<K, V> | null = null
  next: Node<K, V> | null = null

  constructor(key: K, value: V) {
    this.key = key
    this.value = value
  }
}

class LRUCache<K, V> {
  readonly #cache: Map<K, Node<K, V>>
  readonly #maxSize: number
  #head: Node<K, V> | null = null
  #tail: Node<K, V> | null = null

  constructor(maxSize: number) {
    this.#cache = new Map()
    this.#maxSize = maxSize
  }

  get(key: K): V | undefined {
    const node = this.#cache.get(key)
    if (!node) {
      return undefined
    }

    this.#moveToHead(node)
    return node.value
  }

  set(key: K, value: V): V {
    let node = this.#cache.get(key)

    if (node) {
      node.value = value
      this.#moveToHead(node)
    } else {
      node = new Node(key, value)
      this.#cache.set(key, node)
      this.#addNode(node)

      if (this.#cache.size > this.#maxSize) {
        this.#removeTail()
      }
    }
    return value
  }

  get size(): number {
    return this.#cache.size
  }

  #addNode(node: Node<K, V>) {
    node.next = this.#head
    node.prev = null

    if (this.#head) {
      this.#head.prev = node
    }
    this.#head = node

    if (!this.#tail) {
      this.#tail = node
    }
  }

  #removeNode(node: Node<K, V>) {
    if (node.prev) {
      node.prev.next = node.next
    } else {
      this.#head = node.next
    }

    if (node.next) {
      node.next.prev = node.prev
    } else {
      this.#tail = node.prev
    }

    this.#cache.delete(node.key)
  }

  #moveToHead(node: Node<K, V>) {
    this.#removeNode(node)
    this.#addNode(node)
  }

  #removeTail() {
    if (!this.#tail) {
      return
    }
    const tail = this.#tail
    this.#removeNode(tail)
  }
}

export type CacheHandler<K, V> = (key: K, value: () => V) => V

export function createCache<K, V>(maxSize: number): CacheHandler<K, V> {
  const cache = new LRUCache<K, V>(maxSize)

  return (key: K, value: () => V) => {
    const cached = cache.get(key)
    if (cached !== undefined) {
      return cached
    }
    const result = value()
    cache.set(key, result)
    return result
  }
}
