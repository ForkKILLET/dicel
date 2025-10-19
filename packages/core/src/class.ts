import { entries, groupBy, groupByProp, map, pipe } from 'remeda'
import { ClassDefDes } from './node'
import { Type, TypeEnv, TypeScheme } from './type'
import { Dict } from './utils'

export type Instance = {
  classId: string
  arg: Type
}
export type InstanceDict = Dict<Instance[]>
export namespace InstanceDict {
  export const empty = (): InstanceDict => ({})

  export const of = (instances: Instance[]): InstanceDict =>
    groupByProp(instances, 'classId')
}

export namespace Class {
  export const getEnv = (def: ClassDefDes): TypeEnv => pipe(
    entries(def.bindingHost.declDict),
    map(([id, decl]) => [
      id,
      pipe(
        decl.ann.typeScheme,
        TypeScheme.mergeConstrs([{ classId: def.id, arg: def.param }])
      )
    ] as const),
    Dict.of,
  )
}
