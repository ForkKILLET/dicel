import { Err, Ok, Result } from 'fk-result'
import { Pred } from '@/utils/types'
import * as R from 'remeda'
import { pipe, id } from '@/utils/compose'

export class Set<T> extends globalThis.Set<T> {
  static empty = <T>(): Set<T> => new Set()

  static of = <T>(elems: Iterable<T>): Set<T> => new Set(elems)

  static ofMap = <K>(map: Map<K, any>): Set<K> => Set.of(map.keys())

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

  static addToStrict = <T>(set: Set<T>) => (elem: T): Result<Set<T>, T> => {
    if (set.has(elem)) return Err(elem)
    set.add(elem)
    return Ok(set)
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

  static ofDict = <V>(dict: Dict<V>): Map<string, V> => Map.of(R.entries(dict))

  static solo = <K, V>(k: K, v: V): Map<K, V> => Map.of([[k, v]])

  static strictOf = <K, V>(entries: Iterable<readonly [K, V]>): Result<Map<K, V>, [K, V, V]> => {
    const result = Map.empty<K, V>()
    for (const [k, v] of entries) {
      if (result.has(k)) return Err([k, result.get(k)!, v])
      result.set(k, v)
    }
    return Ok(result)
  }

  static disjointUnion = <K, V>(maps: Map<K, V>[]): Result<Map<K, V>, [K, V, V]> => {
    const result = Map.empty<K, V>()
    for (const map of maps) {
      for (const [k, v] of map) {
        if (result.has(k)) return Err([k, result.get(k)!, v])
        result.set(k, v)
      }
    }
    return Ok(result)
  }

  static map = <K, V, U>(transform: (value: V, key: K) => U) => (map: Map<K, V>): Map<K, U> =>
    Map.of([...map].map(([k, v]) => [k, transform(v, k)] as const))

  static forEach = <K, V>(action: (value: V, key: K) => void) => (map: Map<K, V>): Map<K, V> => {
    map.entries().forEach(([k, v]) => action(v, k))
    return map
  }

  static addToStrict = <K, V>(map: Map<K, V>) => ([k, v]: [K, V]): Result<Map<K, V>, [K, V, V]> => {
    if (map.has(k)) return Err([k, map.get(k)!, v])
    map.set(k, v)
    return Ok(map)
  }

  static union = <K, V>(maps: Iterable<Map<K, V>>): Map<K, V> => pipe(
    maps,
    Iter.of,
    Iter.join,
    Map.of,
  )

  static keySet = <K, V>(map: Map<K, V>): Set<K> =>
    Set.of(map.keys())

  static values = <K, V>(map: Map<K, V>): Iterable<V> =>
    map.values()

  static keyOf = <K, V>(map: Map<K, V>) => (key: K): boolean =>
    map.has(key)
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
      const map = Map.of(Iter.of(elems).map(elem => [hasher(elem), elem]))
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
  export const of = <T>(value: Iterator<T> | Iterable<T>) =>
    globalThis.Iterator.from(value)

  export const map = <T, U>(transform: (value: T, ix: number) => U) => (iter: IteratorObject<T>) =>
    iter.map(transform)

  export const forEach = <T>(action: (value: T, ix: number) => void) => (iter: IteratorObject<T>) => {
    iter.forEach(action)
    return iter
  }

  export const toArray = <T>(iter: IteratorObject<T>): T[] =>
    iter.toArray()

  export const join = <T>(iterIter: IteratorObject<Iterable<T> | Iterator<T>>): IteratorObject<T> =>
    iterIter.flatMap(id)

  export const groupToMap = <K, V>(getKey: (value: V) => K) => (iter: Iterable<V>): Map<K, V[]> =>
    Map.groupBy(iter, getKey)
}

export type Dict<T, K extends string = string> = Record<K, T>

export namespace Dict {
  export const empty = <T>(): Dict<T> => ({})

  export const of = <T>(entries: Iterable<readonly [string, T]>): Dict<T> =>
    Object.fromEntries(entries)

  export const strictOf = <T>(entries: Iterable<readonly [string, T]>): Result<Dict<T>, string> => {
    const result: Dict<T> = {}
    for (const [k, v] of entries) {
      if (k in result) return Result.err(k)
      result[k] = v
    }
    return Result.ok(result)
  }

  export const keys = <T, K extends string = string>(dict: Dict<T, K>): K[] =>
    Object.keys(dict) as K[]

  export const map = <T, U>(transform: (value: T, key: string) => U) => (dict: Dict<T>): Dict<U> => {
    const result: Dict<U> = {}
    for (const key in dict) {
      result[key] = transform(dict[key], key)
    }
    return result
  }

  export const pickBySet = <T, K extends string = string>(keySet: ReadonlySetLike<K>) => (dict: Record<K, T>): Record<K, T> => {
    const result = {} as Record<K, T>
    for (const key in dict) {
      if (keySet.has(key)) result[key] = dict[key]
    }
    return result
  }

  export const omitBySet = <T, K extends string = string>(keySet: ReadonlySetLike<K>) => (dict: Record<K, T>): Record<K, T> => {
    const result = {} as Record<K, T>
    for (const key in dict) {
      if (! keySet.has(key)) result[key] = dict[key]
    }
    return result
  }
}

export type Effect<T = void> = () => T

export namespace Effect {
  export const empty: Effect = () => {}

  export const sequence = <T>(effects: Effect<T>[]): Effect<T[]> => {
    return () => effects.map(effect => effect())
  }

  export const sequenceV = (effects: Effect<void>[]): Effect<void> => {
    return () => effects.forEach(effect => effect())
  }
}
