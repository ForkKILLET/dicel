import * as R from 'remeda'
import { pipe } from 'remeda'
import { Comp as Cmp, Ord } from '@/utils/types'

export const unsnoc = <A>(as: A[]): [A[], A] => [
  as.slice(0, -1),
  as[as.length - 1],
]

export const filterKeys = <T>(pred: (key: string) => boolean) =>
  (object: Record<string, T>): Record<string, T> => pipe(
    object,
    R.entries(),
    R.filter(([key]) => pred(key)),
    R.fromEntries(),
  )

export const zip3 = <A, B, C>(as: A[], bs: B[], cs: C[]): [A, B, C][] => {
  const len = Math.min(as.length, bs.length, cs.length)
  const result: [A, B, C][] = []
  for (let i = 0; i < len; i ++) {
    result.push([as[i], bs[i], cs[i]])
  }
  return result
}

export const unzip = <A, B>(abs: Iterable<readonly [A, B]>): [A[], B[]] => {
  const as: A[] = []
  const bs: B[] = []
  for (const [a, b] of abs) {
    as.push(a)
    bs.push(b)
  }
  return [as, bs]
}

export const id = <const A>(a: A): A => a
export const the = <A>(a: NoInfer<A>): A => a

export const memberOf = <T extends object, K extends keyof any>(obj: T) => (key: K): key is K & keyof T => key in obj

export const equalBy = <T, K extends keyof T>(key: K): Cmp<T> => (x, y) => x[key] === y[key]

export const indent = (spaces: number) => (str: string) => {
  const pad = ' '.repeat(spaces)
  return str.split('\n').map(line => pad + line).join('\n')
}

export const maxBy = <T>(ord: Ord<T>) => (xs: T[]): T =>
  xs.reduce((max, x) => ord(max, x) >= 0 ? max : x)

export const minBy = <T>(ord: Ord<T>) => (xs: T[]): T =>
  xs.reduce((min, x) => ord(min, x) <= 0 ? min : x)

export const replicate = <T>(n: number, getValue: () => T): T[] => {
  const result: T[] = []
  for (let i = 0; i < n; i ++) result.push(getValue())
  return result
}

export const coerce = <T, U extends T>(pred: (value: T) => value is U) => (value: T): U => {
  if (pred(value)) return value
  throw new Error(`Coercion failed, got ${String(value)}`)
}

export const split2 = (str: string, sep: string): [string, string] => {
  const ix = str.indexOf(sep)
  if (ix === -1) return [str, '']
  return [str.slice(0, ix), str.slice(ix + sep.length)]
}

export const mapInplace = <T>(arr: T[], f: (item: T, index: number, arr: T[]) => T): T[] => {
  arr.forEach((item, index) => {
    arr[index] = f(item, index, arr)
  })
  return arr
}

export const logWith = <T>(show: (value: T) => string) => (value: T): T => {
  console.log(show(value))
  return value
}

export { pipe, R }
