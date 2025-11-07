import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { Core } from '@/node/stage'
import { DataDefNode } from '@/node/node'
import { ApplyTypeMulti, ConType, FuncTypeMulti, Type, VarType } from '@/type/type'
import { SymIdHeadOptional, SymIdHead } from '@/sym'
import { TypedId as TypedId, TypedValue } from '@/builtin/termType'
import { Map } from '@/utils/data'
import { FuncMultiValue } from './value/value'

export type DataCon<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  params: Type[]
}

export type DataInfo<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  params: VarType[]
  cons: DataCon<SH>[]
}
export type DataMap = Map<string, DataInfo<SymIdHead>>

export namespace DataInfo {
  export const ofNode = (dataDef: DataDefNode<Core>): DataInfo => ({
    id: dataDef.id.id,
    params: dataDef.params.map(R.prop('type')),
    cons: dataDef.cons.map(con => ({
      id: con.func.id,
      params: con.params.map(R.prop('type')),
    })),
  })

  export const getTypeId = (dataInfo: DataInfo<SymIdHead>) => (con: DataCon<SymIdHead>) => ({
    id: con.id,
    symId: con.symId,
    type: Type.generalize(FuncTypeMulti(...con.params, ApplyTypeMulti(ConType(dataInfo.id), ...dataInfo.params))),
  })

  export const getTypeValue = (dataInfo: DataInfo<SymIdHead>) => {
    const _getTypeId = getTypeId(dataInfo)
    return (con: DataCon<SymIdHead>): TypedValue<SymIdHead> => ({
      ..._getTypeId(con),
      value: FuncMultiValue(
        con.params.length,
        (...args) => ({
          ty: 'data',
          con: con.symId,
          args,
        })
      )
    })
  }

  export const getTypedIds = (dataInfo: DataInfo<SymIdHead>): TypedId<SymIdHead>[] => dataInfo.cons.map(getTypeId(dataInfo))

  export const getTypedValues = (dataInfo: DataInfo<SymIdHead>): TypedValue<SymIdHead>[] => dataInfo.cons.map(getTypeValue(dataInfo))
}
