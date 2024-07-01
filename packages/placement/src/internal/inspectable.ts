let inspect: symbol = Symbol('placement/inspect')

try {
  inspect = await import('node:util').then((m) => m.inspect.custom)
} finally {
}

export { inspect }
