export type Func = (...args: any[]) => any
export type Cmp<T> = (a: T, b: T) => number

export type Endo<T> = (x: T) => T

export type Reverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...Reverse<Tail>, Head]
  : []

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