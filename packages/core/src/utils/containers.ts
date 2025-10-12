import { Err, Ok, Result } from 'fk-result'

export class Set<T> extends globalThis.Set<T> {
  static empty = <T>(): Set<T> => new Set()

  static of = <T>(elems: Iterable<T>): Set<T> => new Set(elems)

  static strictOf = <T>(elems: Iterable<T>): Result<Set<T>, T> => {
    const result = Set.empty<T>()
    for (const elem of elems) {
      if (result.has(elem)) return Result.err(elem)
      result.add(elem)
    }
    return Result.ok(result)
  }

  static inter = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.intersection(b))

  static union = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.union(b), Set.empty())

  static disjointUnion = <T>(sets: Set<T>[]): Result<Set<T>, T> => {
    const result = Set.empty<T>()
    for (const set of sets) {
      for (const elem of set) {
        if (result.has(elem)) return Err(elem)
        result.add(elem)
      }
    }
    return Ok(result)
  }

  static toArray = <T>(set: Set<T>): T[] => Array.from(set)

  static map = <T, U>(set: Set<T>, transform: (elem: T) => U): Set<U> => {
    const result = Set.empty<U>()
    for (const elem of set) result.add(transform(elem))
    return result
  }
}

export class Map<K, V> extends globalThis.Map<K, V> {
  static empty = <K, V>(): Map<K, V> => new Map()

  static of = <K, V>(entries: Iterable<readonly [K, V]>): Map<K, V> => new Map(entries)

  static strictOf = <K, V>(entries: Iterable<readonly [K, V]>): Result<Map<K, V>, K> => {
    const result = Map.empty<K, V>()
    for (const [k, v] of entries) {
      if (result.has(k)) return Result.err(k)
      result.set(k, v)
    }
    return Result.ok(result)
  }
}

export class DefaultMap<K, V> extends globalThis.Map<K, V> {
  constructor(public readonly create: () => V, entries?: Iterable<readonly [K, V]>) {
    super(entries)
  }

  static empty = <K, V>(create: () => V): DefaultMap<K, V> => new DefaultMap(create)

  static of = <K, V>(create: () => V, entries: Iterable<readonly [K, V]>): DefaultMap<K, V> => new DefaultMap(create, entries)

  static count = <K>(elems: Iterable<K>): DefaultMap<K, number> => {
    const result = DefaultMap.empty<K, number>(() => 0)
    for (const elem of elems) result.set(elem, result.get(elem) + 1)
    return result
  }

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
