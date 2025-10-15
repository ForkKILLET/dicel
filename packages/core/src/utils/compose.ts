import { entries, filter, fromEntries, pipe } from 'remeda'
import { Err, Ok, Result } from 'fk-result'
import { Comp, Ord } from './types'

export const unsnoc = <A>(as: A[]): [A[], A] => [
  as.slice(0, -1),
  as[as.length - 1],
]

export const filterKeys = <T>(pred: (key: string) => boolean) =>
  (object: Record<string, T>): Record<string, T> => pipe(
    object,
    entries(),
    filter(([key]) => pred(key)),
    fromEntries(),
  )

export const zip3 = <A, B, C>(as: A[], bs: B[], cs: C[]): [A, B, C][] => {
  const len = Math.min(as.length, bs.length, cs.length)
  const result: [A, B, C][] = []
  for (let i = 0; i < len; i ++) {
    result.push([as[i], bs[i], cs[i]])
  }
  return result
}

export const id = <const A>(a: A): A => a
export const the = <A>(a: NoInfer<A>): A => a

export const describeToShow = <T, D>(
  describe: (input: T) => D,
  show: (desc: D, show: (desc: D) => string) => string,
  needsParen: (self: D, parent: D | null) => boolean,
) => {
  const _show = (parent: D | null) => (self: D) => {
    const text = show(self, _show(self))
    return needsParen(self, parent) ? `(${text})` : text
  }
  return (input: T) => _show(null)(describe(input))
}

export const fromEntriesStrict = <K extends keyof any, V>(entries: Iterable<readonly [K, V]>): Result<Record<K, V>, K> => {
  const record = {} as Record<K, V>
  for (const [k, v] of entries) {
    if (k in record) return Err(k)
    record[k] = v
  }
  return Ok(record)
}

export const memberOf = <K extends keyof any>(record: Record<K, any>) =>
  (key: keyof any): key is K => key in record

export const equalBy = <T, K extends keyof T>(key: K): Comp<T> => (x, y) => x[key] === y[key]
