import { Constrs, Type, TypeScheme, VarType } from '@/type/type'
import { TypedId } from '@/builtin/termType'
import { SymIdHeadOptional, SymIdHead, SymId } from '@/sym'
import { AstId } from '@/node/astId'
import { DefaultMap, Map } from '@/utils/data'
import * as R from 'remeda'
import { pipe } from '@/utils/compose'

export type InstanceInfo<SH extends SymIdHeadOptional = {}> = SH & {
  instanceId: string
  classId: string
  arg: Type
  symId: SymId
}
export type InstanceMap = Map<AstId, InstanceInfo<SymIdHead>>
export type ClassInstanceMap = DefaultMap<string, InstanceInfo<SymIdHead>[]>

export type ClassMember<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  astId: AstId
  sigType: TypeScheme
}

export type ClassInfo<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  astId: AstId
  param: VarType
  members: Map<string, ClassMember<SH>>
  constrs: Constrs
}
export type ClassMap = Map<string, ClassInfo<SymIdHead>>

export namespace ClassInfo {
  export const getTypedIds = (classInfo: ClassInfo<SymIdHead>): TypedId<SymIdHead>[] => pipe(
    [...classInfo.members.values()],
    R.map(member => ({
      id: member.id,
      type: pipe(
        member.sigType,
        TypeScheme.unionConstrs([{ classId: classInfo.id, arg: classInfo.param }]),
      ),
      symId: member.symId,
    }))
  )
}
