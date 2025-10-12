export type Subbed = { sub: string }

export type SubbedPair<T extends Subbed> = [T, T]

export namespace SubbedPair {
  export type CompareResult<T extends Subbed, S extends T['sub']> =
    | { type: 'both', pair: SubbedPair<Extract<T, { sub: S }>> }
    | { type: 'one', pair: [Extract<T, { sub: S }>, Exclude<T, { sub: S }>] }
    | { type: 'none', pair: SubbedPair<Exclude<T, { sub: S }>> }

  export const compare = <T extends Subbed, S extends T['sub']>(
    [x, y]: SubbedPair<T>, sub: S
  ): CompareResult<T, S> => {
    if (x.sub === sub && y.sub === sub)
      return { type: 'both', pair: [x, y] as SubbedPair<Extract<T, { sub: S }>> }
    else if (x.sub === sub)
      return { type: 'one', pair: [x, y] as [Extract<T, { sub: S }>, Exclude<T, { sub: S }>] }
    else if (y.sub === sub)
      return { type: 'one', pair: [y, x] as [Extract<T, { sub: S }>, Exclude<T, { sub: S }>] }
    else
      return { type: 'none', pair: [x, y] as SubbedPair<Exclude<T, { sub: S }>> }
  }

  type DiffResultSames<T extends Subbed> = {
    [S in T['sub']]: {
      type: 'same'
      sub: S
      pair: SubbedPair<Extract<T, { sub: S }>>
    }
  }

  export type DiffResult<T extends Subbed> =
    | DiffResultSames<T>[T['sub']]
    | { type: 'diff' }

  export const diff = <T extends Subbed>(
    [x, y]: SubbedPair<T>
  ): DiffResult<T> => {
    if (x.sub === y.sub)
      return { type: 'same', sub: x.sub, pair: [x, y] } as DiffResult<T>
    else
      return { type: 'diff' }
  }
}
