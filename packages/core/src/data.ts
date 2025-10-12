import { pipe, map, fromEntries } from 'remeda'
import { generalize } from './infer'
import { Type, FuncTypeCurried, ApplyTypeCurried, ConType, VarType, TypedValue, TypeEnv, TypedValueEnv, Kind } from './types'
import { ValueEnv } from './execute'
import { ConValue, FuncValueN } from './values'
import { Dict } from './utils'

export type DataCon = {
  id: string
  params: Type[]
}

export namespace DataCon {
}

export type Data = {
  id: string
  typeParams: string[]
  cons: DataCon[]
}
export type DataEnv = Dict<Data>
export type KindedData = Data & { kind: Kind }
export type KindedDataEnv = Dict<KindedData>

export namespace Data {
  export const getType = (id: string, { typeParams }: Data, { params }: DataCon) =>
    FuncTypeCurried(...params, ApplyTypeCurried(ConType(id), ...typeParams.map(id => VarType(id))))

  export const getValue = ({ id, params }: DataCon) =>
    FuncValueN(params.length)((...vals) => ConValue(id, vals))

  export const getEnv = (id: string, data: Data): TypeEnv => pipe(
    data.cons,
    map(con => [
      con.id,
      generalize(getType(id, data, con)),
    ] as const),
    fromEntries(),
  )

  export const getValueEnv = ({ cons }: Data): ValueEnv => pipe(
    cons,
    map(con => [
      con.id,
      { value: getValue(con) },
    ] as const),
    fromEntries(),
  )

  export const getTypedValueEnv = (id: string, data: Data): TypedValueEnv => pipe(
    data.cons,
    map(con => [
      con.id,
      TypedValue(
        getType(id, data, con),
        getValue(con),
      )
    ] as const),
    fromEntries(),
  )
}
