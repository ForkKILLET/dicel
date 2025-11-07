import { match } from 'ts-pattern'
import { isComma } from '@/lex'
import { describeToShow, showStr } from '@/show'
import { Type, extractApplyType } from '@/type/type'
import { Value, extractListValue } from '@/value/value'
import * as R from 'remeda'
import { split2 } from '@/utils/compose'

export type TypedValue = {
  type: Type
  value: Value
}
export namespace TypedValue {
  export type Desc =
    | Value
    | { ty: 'str', val: string }
    | { ty: 'list', elems: Desc[] }
    | { ty: 'tuple', elems: Desc[] }

  export const describe = ({ type, value }: TypedValue): Desc => match<Value, Desc>(value)
    .with({ ty: 'num' }, { ty: 'char' }, { ty: 'func' }, { ty: 'record' }, value => value)
    .with({ ty: 'data' }, value => {
      const [modId, symIdLocal] = split2(value.con, ':')
      if (modId !== 'Builtin') return value
      if (symIdLocal === '[]' || symIdLocal === ':') {
        const { arg: argType } = Type.coerce(type, ['apply'])
        const elems = extractListValue(value)
        if (Type.is(argType, ['con']) && argType.id === 'Builtin:Char') return {
          ty: 'str',
          val: elems.map(elem => Value.coerce(elem, ['char']).val).join(''),
        }
        return {
          ty: 'list',
          elems: elems.map(elem => describe({ type: argType, value: elem }))
        }
      }
      if (isComma(symIdLocal)) {
        const elemTypes = extractApplyType(type)
        return {
          ty: 'tuple',
          elems: R.zip(value.args, elemTypes)
            .map(([argValue, argType]) => describe({ type: argType, value: argValue })),
        }
      }
      return value
    })
    .exhaustive()

  export const show = describeToShow(
    describe,
    (desc, show) => match<Desc, string>(desc)
      .with({ ty: 'num' }, ({ val }) => String(val))
      .with({ ty: 'char' }, ({ val }) => showStr(val, '\''))
      .with({ ty: 'func' }, () => 'Func')
      .with({ ty: 'data' }, ({ con, args }) => [con, ...args.map(show)].join(' '))
      .with({ ty: 'record' }, ({ con, fields }) => `${con} { ${fields.map(show).join(', ')} }`)
      .with({ ty: 'str' }, ({ val }) => showStr(val, '"'))
      .with({ ty: 'list' }, ({ elems }) => `[${elems.map(show).join(', ')}]`)
      .with({ ty: 'tuple' }, ({ elems }) => `(${elems.map(show).join(', ')})`)
      .exhaustive(),
    () => false, // TODO
  )
}

