export type Fn = (...args: any[]) => any

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

export const forEachReverse = <T>(array: T[], fn: (item: T, index: number) => void) => {
  for (let i = array.length - 1; i >= 0; i --) fn(array[i], i)
}