import * as R from 'remeda'
import { pipe } from '@/utils/compose'

import { DataInfo } from '@/data'
import { SymIdHeadOptional, SymIdHead } from '@/sym'
import { Kind, FuncNKind, KindEnv } from '@/type/kind'
import { ApplyTypeMulti, ConType, VarType } from '@/type/type'
import { Dict } from '@/utils/data'

export type KindedData<SH extends SymIdHeadOptional = {}> = {
  data: DataInfo<SH>
  kind: Kind
}

const VarTypes = (...ids: string[]) => ids.map(VarType)

export const BUILTIN_DATA_LIST: KindedData<SymIdHead>[] = [
  {
    data: {
      id: 'Num',
      params: VarTypes(),
      cons: [],
    },
    kind: FuncNKind(1),
  },
  {
    data: {
      id: 'Char',
      params: VarTypes(),
      cons: [],
    },
    kind: FuncNKind(1),
  },
  {
    data: {
      id: '',
      params: VarTypes(),
      cons: [
        { id: '', params: [] }
      ],
    },
    kind: FuncNKind(1),
  },
  {
    data: {
      id: 'Bool',
      params: VarTypes(),
      cons: [
        { id: 'True', params: [] },
        { id: 'False', params: [] },
      ],
    },
    kind: FuncNKind(1),
  },
  {
    data: {
      id: '[]',
      params: VarTypes('a'),
      cons: [
        { id: '[]', params: [] },
        { id: ':', params: [VarType('a'), ApplyTypeMulti(ConType('[]'), VarType('a'))] },
      ],
    },
    kind: FuncNKind(2),
  },
  {
    data: {
      id: ',',
      params: VarTypes('a', 'b'),
      cons: [
        { id: ',', params: [VarType('a'), VarType('b')] }
      ],
    },
    kind: FuncNKind(3),
  },
  {
    data: {
      id: ',,',
      params: VarTypes('a', 'b', 'c'),
      cons: [
        { id: ',,', params: [VarType('a'), VarType('b'), VarType('c')] }
      ],
    },
    kind: FuncNKind(4),
  },
  {
    data: {
      id: ',,,',
      params: VarTypes('a', 'b', 'c', 'd'),
      cons: [
        { id: ',,,', params: [VarType('a'), VarType('b'), VarType('c'), VarType('d')] }
      ],
    },
    kind: FuncNKind(5),
  },
  {
    data: {
      id: ',,,,',
      params: VarTypes('a', 'b', 'c', 'd', 'e'),
      cons: [
        { id: ',,,,', params: [VarType('a'), VarType('b'), VarType('c'), VarType('d'), VarType('e')] }
      ],
    },
    kind: FuncNKind(6),
  },
].map(({ data, kind }): KindedData<SymIdHead> => ({
  data: {
    ...data,
    cons: data.cons.map(con => ({
      ...con,
      symId: `Builtin:${con.id}`
    })),
    symId: `Builtin:${data.id}`
  },
  kind
}))

export const BUILTIN_KIND_ENV: KindEnv = pipe(
  BUILTIN_DATA_LIST,
  R.map(({ data, kind }) => [data.id, kind] as const),
  Dict.of,
)
