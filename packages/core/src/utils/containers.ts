export class Set<T> extends globalThis.Set<T> {
  static empty = <T>(): Set<T> => new Set()

  static of = <T>(elems: Iterable<T>): Set<T> => new Set(elems)

  static inter = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.intersection(b))

  static union = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.union(b), Set.empty())

  static map = <T, U>(set: Set<T>, transform: (elem: T) => U): Set<U> => {
    const result = Set.empty<U>()
    for (const elem of set) result.add(transform(elem))
    return result
  }
}

export class Map<K, V> extends globalThis.Map<K, V> {
  static empty = <K, V>(): Map<K, V> => new Map()

  static of = <K, V>(entries: Iterable<readonly [K, V]>): Map<K, V> => new Map(entries)
}

export class DefaultMap<K, V> extends globalThis.Map<K, V> {
  constructor(public readonly create: () => V, entries?: Iterable<readonly [K, V]>) {
    super(entries)
  }

  static empty = <K, V>(create: () => V): DefaultMap<K, V> => new DefaultMap(create)

  static of = <K, V>(create: () => V, entries: Iterable<readonly [K, V]>): DefaultMap<K, V> => new DefaultMap(create, entries)

  get(key: K): V {
    if (this.has(key)) return super.get(key)!

    const value = this.create()
    this.set(key, value)
    return value
  }

  update(key: K, transform: (current: V) => V): V {
    const value = transform(this.get(key))
    this.set(key, value)
    return value
  }
}
