import { entries, filter, fromEntries, pipe } from 'remeda'

export type Func = (...args: any[]) => any
export type Cmp<T> = (a: T, b: T) => number

export type Endo<T> = (x: T) => T

export type Λ<R extends any = any, As extends any[] = any[]> = {
  '#params': As
  '#ret': R
}
export namespace Λ {
  export type Apply<F extends Λ, As extends F['#params']> =
    F & { args: As } extends infer FA extends { ret: unknown }
      ? FA['ret'] extends infer R extends Ret<Λ>
        ? R
        : never
      : never

  export type Ret<F extends Λ> = F['#ret']

  export type Params<F extends Λ> = F['#params']
  export type Param0<F extends Λ> = Params<F>[0]
  export type Param1<F extends Λ> = Params<F>[1]

  export type Args<F extends Λ> = F extends { args: infer A extends [...Params<F>, ...any[]] } ? A : never
  export type Arg0<F extends Λ> = Args<F>[0]
  export type Arg1<F extends Λ> = Args<F>[1]
}

export type Reverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...Reverse<Tail>, Head]
  : []

export const id = <T>(x: T): T => x
export const the = id

export type NotEmpty<T> = [T, ...T[]]

export const unsnoc = <T>(arr: T[]): [T[], T] => [
  arr.slice(0, -1),
  arr[arr.length - 1],
]

export const filterKeys = <T>(pred: (key: string) => boolean) =>
  (object: Record<string, T>): Record<string, T> => pipe(
    object,
    entries(),
    filter(([key]) => pred(key)),
    fromEntries(),
  )

export const unionSet = <T>(sets: Set<T>[]): Set<T> => sets.reduce((a, b) => a.union(b), new Set)

export const zip3 = <A, B, C>(as: A[], bs: B[], cs: C[]): [A, B, C][] => {
  const len = Math.min(as.length, bs.length, cs.length)
  const result: [A, B, C][] = []
  for (let i = 0; i < len; i ++) {
    result.push([as[i], bs[i], cs[i]])
  }
  return result
}

export type Signal<T> = [T, (val: T) => void]
export const setter = <O extends {}, P extends keyof O>(object: O, prop: P) => (val: O[P]) => { object[prop] = val }
export const signal = <O extends {}, P extends keyof O>(object: O, prop: P): Signal<O[P]> => [ object[prop], setter(object, prop) ]

export class Counter<K> extends Map<K, number> {
  get(key: K) {
    return super.get(key) ?? 0
  }

  count(key: K, delta = 1) {
    const count = this.get(key) + delta
    this.set(key, count)
    return count
  }
}

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
