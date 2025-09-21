import { pipe, map, fromEntries } from 'remeda'
import { TypeEnv, generalize } from './infer'
import { Type, TypeScheme, FuncTypeCurried, ApplyTypeCurried, ConType, VarType, TypedValue } from './types'
import { Ref, ValueEnv } from './execute'
import { ConValue, FuncValueN } from './values'

export type DataCon = {
  id: string
  params: Type[]
}

export namespace DataCon {
}

export type Data = {
  typeParams: string[]
  cons: DataCon[]
}

export type DataEnv = Record<string, Data>

export namespace Data {
  export const getType = (id: string, { typeParams }: Data, { params }: DataCon) =>
    FuncTypeCurried(...params, ApplyTypeCurried(ConType(id), ...typeParams.map(VarType)))

  export const getValue = ({ id, params }: DataCon) =>
    FuncValueN(params.length)((...vals) => ConValue(id, vals))
  
  export const getEnv = (id: string, data: Data): TypeEnv => pipe(
    data.cons,
    map((con): [string, TypeScheme] => [
      con.id,
      generalize(getType(id, data, con))
    ]),
    fromEntries(),
  )

  export const getValueEnv = ({ cons }: Data): ValueEnv => pipe(
    cons,
    map((con): [string, Ref] => [
      con.id,
      { value: getValue(con) },
    ]),
    fromEntries(),
  )

  export const getTypedValueEnv = (id: string, data: Data): Record<string, TypedValue> => pipe(
    data.cons,
    map((con): [string, TypedValue] => [
      con.id,
      TypedValue(
        getType(id, data, con),
        getValue(con),
      )
    ]),
    fromEntries(),
  )
}