import { Err, Ok, Result } from 'fk-result'
import { p, ParseErr, Parser, Range, RunParser, runParser } from 'parsecond'
import { pipe } from 'remeda'
import { ConType, DiceType, FuncType, Type, VarType } from './types'

declare module 'parsecond' {
  interface ParseErrMap {
    IsReserveWord: {
      word: string
    }
  }
}

export type ExRange = { range: Range }
export type ExId = { astId: number }

const pRanged = <T extends Node, E>(parser: Parser<T, E>): Parser<T & ExRange, E> =>
  oldState => parser(oldState).map(({ val, state }) => ({
    val: {
      ...val,
      range: {
        input: state.input,
        start: oldState.index,
        end: state.index,
      }
    },
    state,
  }))

const reverseSeq = <T, U>([head, tail]: [T, [U, T][]]): [T, [U, T][]] =>
  tail.reduce<[T, [U, T][]]>(
    ([headR, tailR], [fst, snd]) => [snd, [[fst, headR], ...tailR]],
    [head, []]
  )

type Associativity = 'left' | 'right'

export const pBinOp = <
  const O extends Ops[],
  A extends Associativity,
  T extends Expr<ExRange>,
  E
>(
  ops: O,
  associativity: A,
  base: Parser<T, E>,
): Parser<Expr<ExRange>, E> => p.map(
    p.ranged(p.seq([
      base,
      p.many(p.seq([p.spaced(p.ranged(p.alt(ops.map(p.str)))), base])),
    ])),
    ({ val: seq, range }) => (associativity === 'left'
      ? pipe(seq, ([head, tail]) => tail
        .reduce<Expr<ExRange>>(
          (lhs, [{ val: op, range: opRange }, rhs]) => ApplyExprCurried({ type: 'varOp', id: op, range: opRange }, [rhs, lhs], range),
          head
        )
      )
      : pipe(reverseSeq(seq), ([head, tail]) => tail
        .reduce<Expr<ExRange>>(
          (rhs, [{ val: op, range: opRange }, lhs]) => ApplyExprCurried({ type: 'varOp', id: op, range: opRange }, [rhs, lhs], range),
          head
        )
      )
    )
  )

export type NumExpr<Ex = {}> = Ex & {
  type: 'num'
  val: number
}
export const pNum: Parser<NumExpr<ExRange>> = pRanged(p.map(p.decimal, val => ({
  type: 'num',
  val,
})))

export type VarOpExpr<Ex = {}> = Ex & {
  type: 'varOp'
  id: Ops
}

export const pParen: Parser<Expr<ExRange>> = p.lazy(() => pRanged(p.parens(p.alt([
  p.map(p.alt(Ops.map(p.str)), (op: Ops): VarOpExpr => ({
    type: 'varOp',
    id: op,
  })),
  pExpr,
]))))

export const pPrimaryExpr: Parser<Expr<ExRange>> = p.lazy(() => p.alt([
  pParen,
  pNum,
  pVar,
]))

export type Identifier = string
export const RESERVE_WORDS = [ 'let', 'in' ]
export const pIdentifier: Parser<Identifier> = p.bind(
  p.notEmpty(p.regex(/[A-Za-z_][A-Za-z_\d]*/)),
  id => p.result(RESERVE_WORDS.includes(id)
    ? Err(ParseErr('IsReserveWord', { word: id }))
    : Ok(id)
  )
)

export type VarExpr<Ex = {}> = Ex & {
  type: 'var'
  id: Identifier
}
export const pVar: Parser<VarExpr<ExRange>> = pRanged(p.map(pIdentifier, id => ({ type: 'var', id })))

export type RollExpr<Ex = {}> = Ex & {
  type: 'roll'
  times: Expr<Ex>
  sides: Expr<Ex>
}
export const pRollExpr: Parser<RollExpr<ExRange>> = p.map(
  p.ranged(p.seq([
    p.opt(pPrimaryExpr),
    p.char('@'),
    pPrimaryExpr,
  ])),
  ({ val: [times, , sides], range }): RollExpr<ExRange> => ({
    type: 'roll',
    times: times ?? {
      type: 'num',
      val: 1,
      range: Range.startOf(range),
    },
    sides,
    range,
  })
)
export const pRollExprL = p.alt([pRollExpr, pPrimaryExpr])

export type ApplyExpr<Ex = {}> = Ex & {
  type: 'apply'
  func: Expr<Ex>
  arg: Expr<Ex>
}
export const ApplyExprCurried = (func: Expr<ExRange>, [arg, ...args]: Expr<ExRange>[], range: Range): ApplyExpr<ExRange> => ({
  type: 'apply',
  func: ! args.length
    ? func
    : ApplyExprCurried(func, args, Range.between(range, args[0].range)),
  arg,
  range,
})
export const pApplyExpr: Parser<ApplyExpr<ExRange>> = pRanged(p.lazy(() => p.map(
  p.ranged(p.seq([
    p.alt([pVar, pParen]),
    p.some(p.spaced(pRollExprL))
  ])),
  ({ val: [func, args], range }) => ApplyExprCurried(func, args.reverse(), range)
)))
export const pApplyExprL = p.alt([pApplyExpr, pRollExprL])

export const pCompExpr: Parser<Expr<ExRange>> = pBinOp(['.'], 'right', pApplyExprL)

export const pMulExpr: Parser<Expr<ExRange>> = pBinOp(['*', '/', '%'], 'left', pCompExpr)

export const pAddExpr: Parser<Expr<ExRange>> = pBinOp(['+', '-'], 'left', pMulExpr)

export const pRelExpr: Parser<Expr<ExRange>> = pBinOp(['<', '>', '<=', '>='], 'left', pAddExpr)

export const pEqExpr: Parser<Expr<ExRange>> = pBinOp(['==', '!='], 'left', pRelExpr)

export const pAndExpr: Parser<Expr<ExRange>> = pBinOp(['&&'], 'left', pEqExpr)

export const pOrExpr: Parser<Expr<ExRange>> = pBinOp(['||'], 'left', pAndExpr)

export const pDolExpr: Parser<Expr<ExRange>> = pBinOp(['$'], 'right', pOrExpr)

export type CondExpr<Ex = {}> = Ex & {
  type: 'cond'
  cond: Expr<Ex>
  yes: Expr<Ex>
  no: Expr<Ex>
}
export const pCondExpr: Parser<Expr<ExRange>> = p.lazy(() => p.map(
  p.seq([
    pDolExpr,
    p.many(p.map(
      p.seq([
        p.spaced(p.char('?')),
        pDolExpr,
        p.spaced(p.char(':')),
        pDolExpr,
      ]),
      ([, yes, , no]): [Expr<ExRange>, Expr<ExRange>] => [yes, no]
    ))
  ]),
  seq => pipe(reverseSeq(seq), ([head, tail]) =>
    tail.reduce<Expr<ExRange>>(
      (no, [yes, cond]): CondExpr<ExRange> => ({
        type: 'cond',
        cond,
        yes,
        no,
        range: Range.between(cond.range, no.range),
      }),
      head
    )
  )
))
export type Binding<Ex = {}> = Ex & {
  type: 'binding'
  lhs: VarExpr<Ex>
  rhs: Expr<Ex>
}
export type LetExpr<Ex = {}> = Ex & {
  type: 'let'
  binding: Binding<Ex> // TODO: -> bindings, for mutual recursion
  body: Expr<Ex>
}
export const LetExprMulti = (
  [binding, ...bindings]: Binding<ExRange>[],
  body: Expr<ExRange>,
  definedVars: string[],
  range: Range,
): Result<LetExpr<ExRange>, string> => {
  const { id } = binding.lhs
  if (definedVars.includes(id))
    return Err(`Redefinition of variable '${id}'`)
  const bodyResult = (bindings.length === 0
    ? Ok(body)
    : LetExprMulti(bindings, body, [...definedVars, id], Range.between(bindings[0].range, range))
  )
  return bodyResult.map((body): LetExpr<ExRange> => ({
    type: 'let',
    binding,
    body,
    range,
  }))
}
export const pLetExpr: Parser<LetExpr<ExRange>> = p.lazy(() => p.bind(
  p.ranged(p.seq([
    p.spaced(p.str('let')),
    p.sep(
      p.map(
        p.seq([pVar, p.spaced(p.char('=')), pExpr]),
        ([lhs, , rhs]) => ({ lhs, rhs })
      ),
      p.spaced(p.char(';'))
    ),
    p.spaced(p.str('in')),
    pExpr,
  ])),
  ({ val: [, bindings, , body], range }) => p.result(
    LetExprMulti(bindings.map((binding): Binding<ExRange> => ({
      type: 'binding',
      ...binding,
      range: Range.between(binding.lhs.range, binding.rhs.range),
    })), body, [], range)
  )
))

export type LambdaExpr<Ex = {}> = Ex & {
  type: 'lambda'
  param: VarExpr<Ex>
  body: Expr<Ex>
}
export const LambdaExprCurried = ([param, ...params]: VarExpr<ExRange>[], body: Expr<ExRange>, range: Range): LambdaExpr<ExRange> => ({
  type: 'lambda',
  param,
  body: ! params.length
    ? body
    : LambdaExprCurried(params, body, Range.between(params[0].range, range)),
  range
})
export const pLambdaExpr: Parser<LambdaExpr<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.spaced(p.char('\\')),
    p.sep(pVar, p.white),
    p.spaced(p.str('->')),
    pExpr,
  ])),
  ({ val: [, params, , body], range }): LambdaExpr<ExRange> => LambdaExprCurried(params, body, range)
))

const isUpper = (char: string) => char >= 'A' && char <= 'Z'
const isLower = (char: string) => char >= 'a' && char <= 'z'

export const pConType: Parser<ConType> = p.map(
  p.guard(pIdentifier, id => isUpper(id[0])),
  (id): ConType => ({
    sub: 'con',
    id,
  })
)

export const pFuncType: Parser<FuncType> = p.lazy(() => p.map(
  p.seq([p.alt([pDiceType, pConType, pVarType, pParenType]), p.spaced(p.str('->')), pType]),
  ([param, , ret]) => FuncType(param, ret)
))

export const pVarType: Parser<VarType> = p.map(
  p.guard(pIdentifier, id => isLower(id[0])),
  (id): VarType => ({
    sub: 'var',
    id,
  })
)

export const pParenType: Parser<Type> = p.lazy(() => p.parens(pType))

export const pDiceType: Parser<DiceType> = p.map(
  p.seq([p.guard(pIdentifier, id => id === 'Dice'), p.alt([pConType, pVarType, pParenType])]),
  ([, inner]) => DiceType(inner)
)

export const pType: Parser<Type> = p.alt([
  pFuncType,
  pConType,
  pVarType,
  pDiceType,
])

export type TypeNode<Ex = {}> = Ex & {
  type: 'type'
  val: Type
}

export const pTypeNode: Parser<TypeNode<ExRange>> = pRanged(p.map(pType, val => ({
  type: 'type',
  val,
})))

export type AnnExpr<Ex = {}> = Ex & {
  type: 'ann'
  expr: Expr<Ex>
  ann: TypeNode<Ex>
}

export const pTermExpr: Parser<Expr<ExRange>> = pRanged(p.alt([
  pLetExpr,
  pLambdaExpr,
  pCondExpr,
]))

export const pAnnExpr: Parser<AnnExpr<ExRange>> = p.map(
  p.ranged(p.seq([pTermExpr, p.spaced(p.str('::')), pTypeNode])),
  ({ val: [expr, , ann], range }): AnnExpr<ExRange> => ({
    type: 'ann',
    expr,
    ann,
    range,
  })
)

export type Expr<Ex = {}> =
  | LetExpr<Ex>
  | CondExpr<Ex>
  | RollExpr<Ex>
  | ApplyExpr<Ex>
  | VarOpExpr<Ex>
  | VarExpr<Ex>
  | NumExpr<Ex>
  | LambdaExpr<Ex>
  | AnnExpr<Ex>

export type Node<Ex = {}> =
  | Expr<Ex>
  | Binding<Ex>
  | TypeNode<Ex>

export type ExprType = Expr['type']

export type ExprParseErr = ParseErr<'ExpectEnd' | 'IsReserveWord'> | null

export const pExpr: Parser<Expr<ExRange>, null | ExprParseErr> = p.alt([
  pAnnExpr,
  pTermExpr,
])

export const Ops = [
  '!=',
  '==',
  '<=',
  '<',
  '>=',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '&&',
  '||',
  '.',
  '$',
] as const
export type Ops = typeof Ops[number]

const withId = <Ex>(expr: Expr<Ex>): Expr<Ex & ExId> => {
  let id = 0

  const traverse = <T extends Node>(node: T): T & ExId => {
    const newNode = { ...node, astId: id ++ }
    switch (newNode.type) {
      case 'num':
      case 'var':
      case 'varOp':
      case 'type':
        break
      case 'apply':
        newNode.func = traverse(newNode.func)
        newNode.arg = traverse(newNode.arg)
        break
      case 'roll':
        newNode.times = traverse(newNode.times)
        newNode.sides = traverse(newNode.sides)
        break
      case 'cond':
        newNode.cond = traverse(newNode.cond)
        newNode.yes = traverse(newNode.yes)
        newNode.no = traverse(newNode.no)
        break
      case 'let':
        newNode.binding = traverse(newNode.binding)
        newNode.body = traverse(newNode.body)
        break
      case 'lambda':
        newNode.param = traverse(newNode.param)
        newNode.body = traverse(newNode.body)
        break
      case 'binding':
        newNode.lhs = traverse(newNode.lhs)
        newNode.rhs = traverse(newNode.rhs)
        break
      case 'ann':
        newNode.expr = traverse(newNode.expr)
        newNode.ann = traverse(newNode.ann)
        break
    }
    return newNode
  }

  return traverse(expr) as Expr<Ex & ExId>
}

export type ExprEx = Expr<ExRange & ExId>
export type NodeEx = Node<ExRange & ExId>

export const parse: RunParser<ExprEx, null | ExprParseErr> =
  runParser(p.map(p.ended(p.spaced(pExpr)), withId))