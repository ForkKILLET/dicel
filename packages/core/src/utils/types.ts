export type Func = (...args: any[]) => any
export type Ctor<T = any> = new (...args: any[]) => T

export type Ord<T> = (x: T, y: T) => number
export type Comp<T> = (x: T, y: T) => boolean
export type Pred<T> = (x: T) => boolean
export type Endo<T> = (x: T) => T
export type Show<T> = (x: T) => string

export type ValueOf<T> = T[keyof T]

export type Last<T extends any[]> = T extends [...any[], infer L] ? L : never
export type Reverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...Reverse<Tail>, Head]
  : []

export type Equal<T, U> =
  (<X>() => X extends T ? 0 : 1) extends
  (<X>() => X extends U ? 0 : 1) ? true : false

export type DOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never

export type MakePartial<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type MakeRequired<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>
