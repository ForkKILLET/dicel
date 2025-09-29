import { entries, filter, fromEntries, pipe } from 'remeda'

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

export const zip3 = <A, B, C>(as: A[], bs: B[], cs: C[]): [A, B, C][] => {
  const len = Math.min(as.length, bs.length, cs.length)
  const result: [A, B, C][] = []
  for (let i = 0; i < len; i ++) {
    result.push([as[i], bs[i], cs[i]])
  }
  return result
}

export const id = <T>(x: T): T => x
export const the = id

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

