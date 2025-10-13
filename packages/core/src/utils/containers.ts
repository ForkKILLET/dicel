import { Err, Ok, Result } from 'fk-result'
import { Pred } from './types'

export class Set<T> extends globalThis.Set<T> {
  static empty = <T>(): Set<T> => new Set()

  static of = <T>(elems: Iterable<T>): Set<T> => new Set(elems)

  static solo = <T>(elem: T): Set<T> => new Set([elem])

  static strictOf = <T>(elems: Iterable<T>): Result<Set<T>, T> => {
    const result = Set.empty<T>()
    for (const elem of elems) {
      if (result.has(elem)) return Result.err(elem)
      result.add(elem)
    }
    return Result.ok(result)
  }

  static union = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.union(b), Set.empty())

  static intersection = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.intersection(b))

  static difference = <T>(b: Set<T>) => (a: Set<T>): Set<T> => a.difference(b)

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

  static filter = <T>(pred: Pred<T>) => (self: Set<T>): Set<T> => {
    const result = Set.empty<T>()
    for (const elem of self) {
      if (pred(elem)) result.add(elem)
    }
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

export type EqSet<H, T> = {
  size: number
  has(value: T): boolean
  add(value: T): EqSet<H, T>
  delete(value: T): EqSet<H, T>

  toArray(): T[]
  keys(): IterableIterator<T>
  [Symbol.iterator](): IterableIterator<T>

  clone(): EqSet<H, T>
  union(other: Iterable<T>): EqSet<H, T>
  intersection(other: ReadonlySetLike<T>): EqSet<H, T>
  difference(other: ReadonlySetLike<T>): EqSet<H, T>
}

export type EqSetConstructor<H, T> = {
  hash(value: T): H

  of(elems: Iterable<T>): EqSet<H, T>
  empty(): EqSet<H, T>
  solo(value: T): EqSet<H, T>

  union(sets: EqSet<H, T>[]): EqSet<H, T>
  intersection(sets: EqSet<H, T>[]): EqSet<H, T>
  difference(other: ReadonlySetLike<T>): (set: EqSet<H, T>) => EqSet<H, T>
}

export const EqSet = <H, T>(hasher: (value: T) => H) => {
  const Self: EqSetConstructor<H, T> = {
    hash: hasher,

    of: (elems) => {
      const map = Map.of(Iter.from(elems).map(elem => [hasher(elem), elem]))
      const self: EqSet<H, T> = {
        get size() {
          return map.size
        },
        has(value) {
          return map.has(hasher(value))
        },
        add(value) {
          map.set(hasher(value), value)
          return self
        },
        delete(value) {
          map.delete(hasher(value))
          return self
        },

        toArray() {
          return Array.from(map.values())
        },
        keys() {
          return map.values()
        },
        [Symbol.iterator]() {
          return self.keys()
        },

        clone() {
          return Self.of(self)
        },
        union(other) {
          const result = self.clone()
          for (const elem of other) result.add(elem)
          return result
        },
        intersection(other) {
          const result = Self.empty()
          for (const elem of self) if (other.has(elem)) result.add(elem)
          return result
        },
        difference(other) {
          const result = Self.empty()
          for (const elem of self) if (! other.has(elem)) result.add(elem)
          return result
        },
      }
      return self
    },
    empty: () => Self.of([]),
    solo: (value: T) => Self.of([value]),

    union: (sets) => sets.reduce((x, y) => x.union(y), Self.empty()),
    intersection: (sets) => sets.reduce((x, y) => x.intersection(y)),
    difference: (other) => (set) => set.difference(other),
  }
  return Self
}

export namespace Iter {
  export const from = <T>(value: Iterator<T> | Iterable<T>) =>
    globalThis.Iterator.from(value)

  export const map = <T, U>(transform: (value: T, index: number) => U) => (iter: IteratorObject<T>) =>
    iter.map(transform)
}

export type Dict<T> = Record<string, T>

export namespace Dict {
  export const fromEntries = <T>(entries: Iterable<readonly [string, T]>): Dict<T> =>
    Object.fromEntries(entries)
}
