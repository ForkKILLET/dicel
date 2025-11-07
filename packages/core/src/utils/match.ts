export type Ty = { ty: string }

export type TyPair<T extends Ty> = [T, T]

export namespace TyPair {
  export type CompareResult<T extends Ty, S extends T['ty']> =
    | { type: 'both', pair: TyPair<Extract<T, { ty: S }>> }
    | { type: 'one', pair: [Extract<T, { ty: S }>, Exclude<T, { ty: S }>] }
    | { type: 'none', pair: TyPair<Exclude<T, { ty: S }>> }

  export const compare = <T extends Ty, S extends T['ty']>(
    [x, y]: TyPair<T>, ty: S
  ): CompareResult<T, S> => {
    if (x.ty === ty && y.ty === ty)
      return { type: 'both', pair: [x, y] as TyPair<Extract<T, { ty: S }>> }
    else if (x.ty === ty)
      return { type: 'one', pair: [x, y] as [Extract<T, { ty: S }>, Exclude<T, { ty: S }>] }
    else if (y.ty === ty)
      return { type: 'one', pair: [y, x] as [Extract<T, { ty: S }>, Exclude<T, { ty: S }>] }
    else
      return { type: 'none', pair: [x, y] as TyPair<Exclude<T, { ty: S }>> }
  }

  type DiffResultSames<T extends Ty> = {
    [S in T['ty']]: {
      type: 'same'
      ty: S
      pair: TyPair<Extract<T, { ty: S }>>
    }
  }

  export type DiffResult<T extends Ty> =
    | DiffResultSames<T>[T['ty']]
    | { type: 'diff' }

  export const diff = <T extends Ty>(
    [x, y]: TyPair<T>
  ): DiffResult<T> => {
    if (x.ty === y.ty)
      return { type: 'same', ty: x.ty, pair: [x, y] } as DiffResult<T>
    else
      return { type: 'diff' }
  }
}
