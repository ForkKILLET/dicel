import { match } from 'ts-pattern'
import { describeToShow, Endo, Func, id } from './utils'

export type NumValue = { tag: 'num', val: number }
export const NumValue = (val: number): NumValue => ({ tag: 'num', val })

export type BoolValue = ConValue<'True' | 'False'>
export const BoolValue = (val: boolean): BoolValue => ({ tag: 'con', id: val ? 'True' : 'False', args: [] })

export type UnitValue = { tag: 'unit' }
export const UnitValue = (): UnitValue => ({ tag: 'unit' })

export type FuncValue = { tag: 'func', val: Endo<Value> }
export const FuncValue = (func: Endo<Value>): FuncValue => ({ tag: 'func', val: func })
export const FuncValue2 = (func: (arg1: Value, arg2: Value) => Value) =>
  FuncValue(arg1 => FuncValue(arg2 => func(arg1, arg2)))
export const FuncValue3 = (func: (arg1: Value, arg2: Value, arg3: Value) => Value) =>
  FuncValue(arg1 => FuncValue(arg2 => FuncValue(arg3 => func(arg1, arg2, arg3))))
export const FuncValueN = (arity: number) => (func: (...args: Value[]) => Value): Value =>
  arity === 0
    ? func()
    : FuncValue(arg => FuncValueN(arity - 1)((...args) => func(arg, ...args)))

export type ConValue<K extends string = string> = { tag: 'con', id: K, args: Value[] }
export const ConValue = (id: string, vals: Value[]): ConValue => ({ tag: 'con', id, args: vals })

export type ErrValue = { tag: 'err', msg: string }
export const ErrValue = (msg: string): ErrValue => ({ tag: 'err', msg })

export type Value =
  | NumValue
  | BoolValue
  | UnitValue
  | FuncValue
  | ConValue
  | ErrValue

export type ValueTag = Value['tag']

export type MappableValue = NumValue | BoolValue | UnitValue | FuncValue
export type MappableValueJ = number | boolean | null | Func | ErrValue
export type MVJ = MappableValueJ

export const FuncValueJ = <T1 extends MVJ, T2 extends MVJ>(
  func: (a1: T1) => T2
) => FuncValue(v1 => Value.map([v1], func))
export const FuncValueJ2 = <T1 extends MVJ, T2 extends MVJ, T3 extends MVJ>(
  func: (a1: T1, a2: T2) => T3
) => FuncValue(v1 => FuncValue(v2 => Value.map([v1, v2], func)))
export const FuncValueJ3 = <T1 extends MVJ, T2 extends MVJ, T3 extends MVJ, T4 extends MVJ>(
  func: (a1: T1, a2: T2, a3: T3) => T4
) => FuncValue(v1 => FuncValue(v2 => FuncValue(v3 => Value.map([v1, v2, v3], func))))

export type ValueDesc =
  | { tag: 'num', val: number }
  | { tag: 'unit' }
  | { tag: 'func', val: Endo<Value> }
  | { tag: 'list', vals: ValueDesc[] }
  | { tag: 'tuple', vals: ValueDesc[] }
  | { tag: 'con', id: string, args: ValueDesc[] }
  | { tag: 'err', msg: string }

export const uncurryListValue = (val: Value): Value[] => {
  Value.assert(val, 'con')
  if (val.id === '[]') return []
  if (val.id === '#') {
    const [head, tail] = val.args
    return [head, ...uncurryListValue(tail)]
  }
  throw new TypeError(`Expected constructor of List, got ${val.id}.`)
}

export namespace Value {
  export const is = <const Ts extends ValueTag[]>(val: Value, tags: Ts): val is Value & { tag: Ts[number] } =>
    tags.includes(val.tag)
  export const isCon = <const Ks extends string[]>(val: Value, ids: Ks): val is Value & { tag: 'con', id: Ks[number] } =>
    val.tag === 'con' && ids.includes(val.id)

  export const wrap = (valuej: MappableValueJ): Value => match(valuej)
    .when(value => typeof value === 'number', NumValue)
    .when(value => typeof value === 'boolean', BoolValue)
    .when(value => typeof value === 'function', FuncValue)
    .when(value => value === null, UnitValue)
    .with({ tag: 'err' }, id)
    .run()

  export const unwrap = (value: MappableValue): MappableValueJ => match(value)
    .with({ tag: 'unit' }, () => null)
    .with({ tag: 'con' }, value => value.id === 'True')
    .otherwise(({ val }) => val)
    
  export const map = <const Vs extends MappableValueJ[]>(
    vals: { [I in keyof Vs]: Value },
    transform: (...vals: Vs) => MappableValueJ,
  ): Value => wrap(transform(...(vals as MappableValue[]).map(unwrap) as Vs))

  export function assert<T extends ValueTag>(value: Value, tag: T): asserts value is Value & { tag: T } {
    if (value.tag !== tag) throw new TypeError(`Expected value of tag ${tag}, got ${value.tag}.`)
  }

  export const coerce = <T extends ValueTag>(value: Value, tag: T): Value & { tag: T } => {
    Value.assert(value, tag)
    return value
  }

  export const describe = (value: Value): ValueDesc => match<Value, ValueDesc>(value)
    .with({ tag: 'num' }, { tag: 'unit' }, { tag: 'err' }, { tag: 'func' }, value => value)
    .with({ tag: 'con' }, value => match<ConValue, ValueDesc>(value)
      .when(({ id }) => id.includes(','), ({ args }) => ({
        tag: 'tuple',
        vals: args.map(describe)
      }))
      .with({ id: '#' }, { id: '[]' }, value => ({
        tag: 'list',
        vals: uncurryListValue(value),
      }))
      .otherwise(({ id, args }) => ({
        tag: 'con',
        id,
        args: args.map(describe),
      }))
    )
    .exhaustive()

  export const needsParen = (self: ValueDesc, parent: ValueDesc | null): boolean => parent !== null && (
    parent.tag === 'con' && self.tag === 'con' && self.args.length > 0
  )

  export const show = describeToShow<Value, ValueDesc>(
    describe,
    (val, show) => match(val)
      .with({ tag: 'num' }, ({ val }) => String(val))
      .with({ tag: 'unit' }, () => '()')
      .with({ tag: 'func' }, () => 'Func')
      .with({ tag: 'con' }, ({ id, args }) => match(id)
        .with(',', () => `(${args.map(show).join(', ')})`)
        .otherwise(() => [id, ...args.map(show)].join(' '))
      )
      .with({ tag: 'list' }, ({ vals }) => `[${vals.map(show).join(', ')}]`)
      .with({ tag: 'tuple' }, ({ vals }) => `(${vals.map(show).join(', ')})`)
      .with({ tag: 'err' }, () => `Err`)
      .exhaustive(),
    needsParen,
  )
}

