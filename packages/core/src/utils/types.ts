export type Func = (...args: any[]) => any
export type Cmp<T> = (a: T, b: T) => number

export type ValueOf<T> = T[keyof T]

export type Endo<T> = (x: T) => T

export type Last<T extends any[]> = T extends [...any[], infer L] ? L : never
export type Reverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...Reverse<Tail>, Head]
  : []