import { pipe, map, fromEntries } from 'remeda'
import { generalize } from './infer'
import { Type, FuncTypeMulti, ApplyTypeMulti, ConType, VarType, TypedValue, TypeEnv, TypedValueEnv, Kind } from './type'
import { ValueEnv } from './execute'
import { ConValue, FuncValueN } from './value'
import { Dict } from './utils'

export type DataCon = {
  id: string
  params: Type[]
}

export namespace DataCon {
}

export type Data = {
  id: string
  typeParams: VarType[]
  cons: DataCon[]
}
export type DataEnv = Dict<Data>
export type KindedData = Data & { kind: Kind }
export type KindedDataEnv = Dict<KindedData>

export namespace Data {
  export const getType = ({ id, typeParams }: Data, { params }: DataCon) =>
    FuncTypeMulti(...params.map(Type.rigidify), ApplyTypeMulti(ConType(id), ...typeParams.map(Type.rigidify)))

  export const getValue = ({ id, params }: DataCon) =>
    FuncValueN(params.length)((...vals) => ConValue(id, vals))

  export const getEnv = (data: Data): TypeEnv => pipe(
    data.cons,
    map(con => [
      con.id,
      generalize(getType(data, con)),
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

  export const getTypedValueEnv = (data: Data): TypedValueEnv => pipe(
    data.cons,
    map(con => [
      con.id,
      TypedValue(
        getType(data, con),
        getValue(con),
      )
    ] as const),
    fromEntries(),
  )
}
