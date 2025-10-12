export type Func = (...args: any[]) => any
export type Cmp<T> = (a: T, b: T) => number

export type ValueOf<T> = T[keyof T]

export type Endo<T> = (x: T) => T

export type Last<T extends any[]> = T extends [...any[], infer L] ? L : never
export type Reverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...Reverse<Tail>, Head]
  : []

export type Dict<T> = Record<string, T>

export type Equal<T, U> =
  (<X>() => X extends T ? 0 : 1) extends
  (<X>() => X extends U ? 0 : 1) ? true : false
