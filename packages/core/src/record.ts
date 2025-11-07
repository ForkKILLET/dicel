import { SymIdHeadOptional, SymIdHead } from '@/sym'
import { Type, VarType } from '@/type/type'
import { AstId } from '@/node/astId'
import { Dict } from '@/utils/data'

export type RecordField = {
  id: string
  type: Type
}

export type RecordInfo<SH extends SymIdHeadOptional = {}> = SH & {
  id: string
  astId: AstId
  params: VarType[]
  fieldDict: Dict<RecordField>
}
export type RecordMap = Map<string, RecordInfo<SymIdHead>>
