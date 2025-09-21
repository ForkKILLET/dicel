import { Err, Ok, Result } from 'fk-result'
import { p, ParseErr, Parser, ParserState, Range } from 'parsecond'
import { groupByProp, pipe } from 'remeda'
import { match } from 'ts-pattern'
import { ApplyTypeCurried, ConType, FuncType, Type, uncurryApplyType, VarType } from './types'
import { describeToShow } from './utils'
import { Data } from './data'

declare module 'parsecond' {
  export interface ParseErrMap {
    IsReserveWord: {
      word: string
    }
    ConflictDefinition: {
      id: string
    }
    IllegalPattern: {}
    NotAConstructor: {
      type: Type
    }
    TooLargeTuple: {
      size: number
    }
  }

  export interface ParserState {
    layout: number[]
  }
}

export type P<T> = Parser<T, ParseErr | null>

export type ExRange = { range: Range }
export type ExId = { astId: number }

const getCol = (state: ParserState): number => {
  let { index } = state
  while (index >= 0 && state.input[index] !== '\n') index --
  return state.index - index - 1
}

const pLayoutBegin = <T, E>(parser: Parser<T, E>): Parser<T, E> =>
  p.bind(
    p.many(p.oneOf(' \n')),
    () => state => parser({ ...state, layout: [getCol(state), ...state.layout] }),
  )

const pLayout = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.bindValState(
  p.many(p.oneOf(' \n')),
  (({ state, val }) => {
    if (val.length && state.rest && getCol(state) <= state.layout[0]) return p.fail(null)
    return parser
  })
)

const pLayoutAligned = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.bindValState(
  p.many(p.oneOf(' \n')),
  (({ state, val }) => {
    if (val.length && getCol(state) < state.layout[0]) return p.fail(null)
    return parser
  })
)

const pLayoutEnd = <T, E>(parser: Parser<T, E>): Parser<T, E> =>
  p.mapState(parser, state => ({ ...state, layout: state.layout.slice(1) }))

const pBlock = <T, E>(parser: Parser<T, E>): Parser<T[], E | null> => pLayout(
  p.map(
    p.seq([
      pLayout(pLayoutBegin(parser)),
      pLayoutEnd(p.many(pLayoutAligned(parser))),
    ]),
    ([head, tail]) => [head, ...tail]
  )
)

const pSpace = pLayout(p.pure(null))
const pSpaced = p.right(pSpace)
const pSpacedAround = p.delimitedBy(pSpace, pSpace)

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

export type NumExpr<Ex = {}> = Ex & {
  type: 'num'
  val: number
}
export const pNum: P<NumExpr<ExRange>> = pRanged(p.map(p.decimal, val => ({
  type: 'num',
  val,
})))

export type UnitExpr<Ex = {}> = Ex & {
  type: 'unit'
}

export const RESERVE_WORDS = [ 'let', 'in', 'case', 'of', 'data', 'class', 'where' ]
export const pIdentifier: P<string> = p.bind(
  p.notEmpty(p.regex(/[A-Za-z][A-Za-z\d']*|_[A-Za-z\d']+/)),
  id => p.result(RESERVE_WORDS.includes(id)
    ? Err(ParseErr('IsReserveWord', { word: id }))
    : Ok(id)
  )
)

export const SYMBOL_CHARS = '+-*/^%<>=!~&|.$#,'
export const isSymbol = (str: string) => [...str].every(ch => SYMBOL_CHARS.includes(ch))
export const isUpper = (char: string) => char >= 'A' && char <= 'Z'
export const isLower = (char: string) => char >= 'a' && char <= 'z'

export const pSymbol = p.join(p.some(p.oneOf(SYMBOL_CHARS)))

export type TupleExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'tuple'
  elems: NodeClass<Ex, C>[]
}

export const pTupleExprInner: P<TupleExpr<ExRange>> = p.lazy(() => pRanged(p.bind(
  p.sep(pExpr, pSpacedAround(p.char(','))),
  (elems) => p.result(
    elems.length < 2 ? Err(null) :
    elems.length > 4 ? Err(ParseErr('TooLargeTuple', { size: elems.length })) :
    Ok({ type: 'tuple', elems })
  )
)))

export const pUnitExprInner: P<UnitExpr<ExRange>> = pRanged(p.pure({ type: 'unit' }))

export const pSymbolVarExprInner: P<VarExpr<ExRange>> = pRanged(p.map(pSymbol, (id): VarExpr => ({ type: 'var', id })))

export const pParenExpr: P<Expr<ExRange>> = p.parens(
  pSpacedAround(p.alt([
    pTupleExprInner,
    p.lazy(() => pExpr),
    pSymbolVarExprInner,
    pUnitExprInner,
  ]))
)

export type ListExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'list'
  elems: NodeClass<Ex, C>[]
}

export const pListExpr: P<ListExpr<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.brackets(pSpacedAround(p.alt([
    p.sep(pExpr, pSpacedAround(p.char(','))),
    p.pure<Expr<ExRange>[]>([]),
  ])))),
  ({ val: elems, range }) => ({
    type: 'list',
    elems,
    range,
  })
))

export const pPrimaryExpr: P<Expr<ExRange>> = p.lazy(() => p.alt([
  pParenExpr,
  pListExpr,
  pNum,
  pVar,
  pCon,
]))

export type VarExpr<Ex = {}> = Ex & {
  type: 'var'
  id: string
}
export const pVar: P<VarExpr<ExRange>> = pRanged(p.map(
  p.guard(pIdentifier, id => ! isUpper(id[0])),
  id => ({ type: 'var', id })
))
export const pCon: P<VarExpr<ExRange>> = pRanged(p.map(
  p.guard(pIdentifier, id => isUpper(id[0])),
  id => ({ type: 'var', id })
))

export const pRollExpr: P<ApplyExpr<ExRange>> = p.map(
  p.ranged(p.seq([
    p.opt(pPrimaryExpr),
    p.char('@'),
    pPrimaryExpr,
  ])),
  ({ val: [times, , sides], range }): ApplyExpr<ExRange> => _ApplyExprCurried(
    { type: 'var', id: 'roll', range },
    [
      sides,
      times ? times : { type: 'num', val: 1, range: Range.startOf(range) },
    ],
    range,
  )
)
export const pRollExprL = p.alt([pRollExpr, pPrimaryExpr])

export type ApplyExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'apply'
  func: NodeClass<Ex, C>
  arg: NodeClass<Ex, C>
}
const _ApplyExprCurried = (func: Expr<ExRange>, [arg, ...args]: Expr<ExRange>[], range: Range): ApplyExpr<ExRange> => ({
  type: 'apply',
  func: ! args.length
    ? func
    : _ApplyExprCurried(func, args, Range.outer(range, args[0].range)),
  arg,
  range,
})
export const ApplyExprCurried = (func: Expr<ExRange>, args: Expr<ExRange>[], range: Range) =>
  _ApplyExprCurried(func, args.toReversed(), range)

export const uncurryApplyExpr = (expr: ApplyExpr<ExRange>): Expr<ExRange>[] => expr.func.type === 'apply'
    ? [...uncurryApplyExpr(expr.func), expr.arg]
    : [expr.func, expr.arg]

export const pApplyExpr: P<ApplyExpr<ExRange>> = pRanged(p.lazy(() => p.map(
  p.ranged(p.seq([
    p.alt([pVar, pCon, pParenExpr]),
    p.some(pSpaced(pRollExprL))
  ])),
  ({ val: [func, args], range }) => ApplyExprCurried(func, args, range)
)))
export const pApplyExprL = p.alt([pApplyExpr, pRollExprL])

export type Associativity = 'left' | 'right'

export type BinOpExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'binOp'
  op: VarExpr<Ex>
  lhs: NodeClass<Ex, C>
  rhs: NodeClass<Ex, C>
}

export const pBinOp = <T extends Expr<ExRange>, E>(
  ops: string[],
  associativity: Associativity,
  base: Parser<T, E>,
): Parser<Expr<ExRange>, E> => p.map(
    p.ranged(p.seq([
      base,
      p.many(p.seq([
        pSpaced(p.ranged(p.alt(ops.map(p.str)))),
        pSpaced(base),
      ])),
    ])),
    ({ val: seq, range }) => (associativity === 'left'
      ? pipe(seq, ([head, tail]) => tail
        .reduce<Expr<ExRange>>(
          (lhs, [{ val: op, range: opRange }, rhs]): BinOpExpr<ExRange> => ({
            type: 'binOp',
            op: { type: 'var', id: op, range: opRange },
            lhs,
            rhs,
            range: Range.outer(lhs.range, rhs.range),
          }),
          head
        )
      )
      : pipe(reverseSeq(seq), ([head, tail]) => tail
        .reduce<Expr<ExRange>>(
          (rhs, [{ val: op, range: opRange }, lhs]): BinOpExpr<ExRange> => ({
            type: 'binOp',
            op: { type: 'var', id: op, range: opRange },
            lhs,
            rhs,
            range: Range.outer(lhs.range, rhs.range),
          }),
          head
        )
      )
    )
  )

export const pCompExpr: P<Expr<ExRange>> = pBinOp(['.'], 'right', pApplyExprL)

export const pMulExpr: P<Expr<ExRange>> = pBinOp(['*', '/', '%'], 'left', pCompExpr)

export const pAddExpr: P<Expr<ExRange>> = pBinOp(['+', '-'], 'left', pMulExpr)

export const pRelExpr: P<Expr<ExRange>> = pBinOp(['<=', '>=', '<', '>'], 'left', pAddExpr)

export const pEqExpr: P<Expr<ExRange>> = pBinOp(['==', '!='], 'left', pRelExpr)

export const pAndExpr: P<Expr<ExRange>> = pBinOp(['&&'], 'left', pEqExpr)

export const pOrExpr: P<Expr<ExRange>> = pBinOp(['||'], 'left', pAndExpr)

export const pConsExpr: P<Expr<ExRange>> = pBinOp(['#'], 'right', pOrExpr)

export const pPipeExpr: P<Expr<ExRange>> = pBinOp(['|>'], 'left', pConsExpr)

export const pDolExpr: P<Expr<ExRange>> = pBinOp(['$'], 'right', pPipeExpr)

export type CondExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'cond'
  cond: NodeClass<Ex, C>
  yes: NodeClass<Ex, C>
  no: NodeClass<Ex, C>
}
export const pCondExpr: P<Expr<ExRange>> = p.lazy(() => p.map(
  p.seq([
    pDolExpr,
    p.many(p.map(
      p.seq([
        pSpacedAround(p.char('?')),
        pDolExpr,
        pSpacedAround(p.char(':')),
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
        range: Range.outer(cond.range, no.range),
      }),
      head
    )
  )
))
export type Binding<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'binding'
  lhs: Pattern<Ex>
  rhs: NodeClass<Ex, C>
}
export const pBinding: P<Binding<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([pPattern, pSpacedAround(p.char('=')), pExpr])),
  ({ val: [lhs, , rhs], range }): Binding<ExRange> => ({
    type: 'binding',
    lhs,
    rhs,
    range,
  })
))

export type LetExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'let'
  bindings: Binding<Ex, C>[]
  body: NodeClass<Ex, C>
}
export const pLetExpr: P<LetExpr<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.str('let'),
    pBlock(pBinding),
    pSpacedAround(p.str('in')),
    pExpr,
  ])),
  ({ val: [, bindings, , body], range }): LetExpr<ExRange> => ({
    type: 'let',
    bindings,
    body,
    range,
  })
))

export type WildcardPattern<Ex = {}> = Ex & {
  type: 'pattern'
  sub: 'wildcard'
}

export type NumPattern<Ex = {}> = Ex & {
  type: 'pattern'
  sub: 'num'
  val: number
}

export type UnitPattern<Ex = {}> = Ex & {
  type: 'pattern'
  sub: 'unit'
}

export type ConPattern<Ex = {}> = Ex & {
  type: 'pattern'
  sub: 'con'
  con: VarExpr<Ex>
  args: Pattern<Ex>[]
}

export type VarPattern<Ex = {}> = Ex & {
  type: 'pattern'
  sub: 'var'
  var: VarExpr<Ex>
}

export type Pattern<Ex = {}> =
  | WildcardPattern<Ex>
  | NumPattern<Ex>
  | UnitPattern<Ex>
  | ConPattern<Ex>
  | VarPattern<Ex>

export type CaseBranch<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'caseBranch'
  pattern: Pattern<Ex>
  body: NodeClass<Ex, C>
}

export type CaseExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'case'
  subject: NodeClass<Ex, C>
  branches: CaseBranch<Ex, C>[]
}

export const pWildcardPattern: P<WildcardPattern<ExRange>> = pRanged(p.map(p.char('_'), () => ({
  type: 'pattern',
  sub: 'wildcard',
})))

export const pNumPattern: P<NumPattern<ExRange>> = pRanged(p.map(pNum, ({ val }) => ({
  type: 'pattern',
  sub: 'num',
  val,
})))

export const pUnitPattern: P<UnitPattern<ExRange>> = pRanged(
  p.parens(pSpaced(p.pure({ type: 'pattern', sub: 'unit' })))
)

export const pConPattern: P<ConPattern<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    pCon,
    p.many(pSpaced(pPattern)),
  ])),
  ({ val: [con, args], range }): ConPattern<ExRange> => ({
    type: 'pattern',
    sub: 'con',
    con,
    args,
    range,
  })
))

export const pListPattern: P<Pattern<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.brackets(p.alt([
    p.sep(pPattern, pSpacedAround(p.char(','))),
    p.pure<Pattern<ExRange>[]>([]),
  ]))),
  ({ val: elems, range }): Pattern<ExRange> => elems.reduceRight<Pattern<ExRange>>(
    (last, init) => ({
      type: 'pattern',
      sub: 'con',
      con: { type: 'var', id: '#', range: Range.empty() },
      args: [init, last],
      range: Range.outer(init.range, last.range),
    }),
    ({
      type: 'pattern',
      sub: 'con',
      con: { type: 'var', id: '[]', range: Range.endOf(range) },
      args: [],
      range: Range.endOf(range),
    })
  )
))

export const pParenPattern: P<Pattern<ExRange>> = p.lazy(() => p.parens(p.alt([
  p.map(
    p.ranged(p.seq([pPattern, pSpacedAround(p.ranged(p.char(','))), pPattern])),
    ({ val: [lhs, comma, rhs], range }): ConPattern<ExRange> => ({
      type: 'pattern',
      sub: 'con',
      con: { type: 'var', id: ',', range: comma.range },
      args: [lhs, rhs],
      range,
    })
  ),
  pPattern,
])))

export const pVarPattern: P<VarPattern<ExRange>> = p.map(pVar, (var_) => ({
  type: 'pattern',
  sub: 'var',
  var: var_,
  range: var_.range,
}))

export const pPrimaryPattern: P<Pattern<ExRange>> = p.alt([
  pParenPattern,
  pListPattern,
  pVarPattern,
  pWildcardPattern,
  pConPattern,
  pNumPattern,
  pUnitPattern,
])

export const pConsPattern: P<Pattern<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([pPrimaryPattern, p.ranged(pSpacedAround(p.char('#'))), pPattern])),
  ({ val: [head, sharp, tail], range }): ConPattern<ExRange> => ({
    type: 'pattern',
    sub: 'con',
    con: { type: 'var', id: '#', range: sharp.range },
    args: [head, tail],
    range,
  })
))

export const pPattern: P<Pattern<ExRange>> = p.alt([pConsPattern, pPrimaryPattern])

export const pCaseBranch: P<CaseBranch<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    pPattern,
    pSpacedAround(p.str('->')),
    pExpr,
  ])),
  ({ val: [pattern, , body], range }): CaseBranch<ExRange> => ({
    type: 'caseBranch',
    pattern,
    body,
    range,
  })
))

export const pCaseExpr: P<CaseExpr<ExRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.str('case'),
    pSpaced(pExpr),
    pSpacedAround(p.str('of')),
    pBlock(pCaseBranch),
  ])),
  ({ val: [, subject, , cases], range }): CaseExpr<ExRange> => ({
    type: 'case',
    subject,
    branches: cases,
    range,
  }))
)

export type LambdaExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'lambda'
  param: Pattern<Ex>
  body: NodeClass<Ex, C>
}
export const LambdaExprCurried = (
  [param, ...params]: Pattern<ExRange>[],
  body: Expr<ExRange>,
  range: Range
): Result<LambdaExpr<ExRange>, ParseErr<'ConflictDefinition'>> => {
  return (! params.length
    ? Ok(body)
    : LambdaExprCurried(params, body, Range.outer(params[0].range, range))
  ).map((body) => ({
    type: 'lambda',
    param,
    body,
    range
  }))
}
export const pLambdaExpr: P<LambdaExpr<ExRange>> = p.lazy(() => p.bind(
  p.ranged(p.seq([
    p.char('\\'),
    p.some(pSpaced(pPattern)),
    pSpacedAround(p.str('->')),
    pExpr,
  ])),
  ({ val: [, params, , body], range }) => p.result(LambdaExprCurried(params, body, range))
))

export type LambdaCaseExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'lambdaCase'
  branches: CaseBranch<Ex, C>[]
}
export const pLambdaCaseExpr: P<LambdaCaseExpr<ExRange>> = p.lazy(() => pRanged(p.map(
  p.seq([
    p.char('\\'),
    pSpaced(p.str('case')),
    pBlock(pCaseBranch),
  ]),
  ([, , branches]) => ({
    type: 'lambdaCase',
    branches,
  })
)))

export const pConType: P<ConType> = p.map(
  p.guard(pIdentifier, id => isUpper(id[0])),
  (id): ConType => ({
    sub: 'con',
    id,
  })
)

export const pParenType: P<Type> = p.lazy(() => p.parens(pType))

export const pPrimaryType: P<Type> = p.lazy(() => p.alt([
  pParenType,
  pConType,
  pVarType,
]))

export const pApplyType: P<Type> = p.lazy(() => p.map(
  p.seq([
    p.alt([pConType, pVarType]),
    p.some(pSpaced(p.alt([pFuncType, pPrimaryType]))),
  ]),
  ([func, args]) => ApplyTypeCurried(func, ...args)
))

export const pFuncType: P<FuncType> = p.lazy(() => p.map(
  p.seq([pPrimaryType, pSpaced(p.str('->')), pType]),
  ([param, , ret]) => FuncType(param, ret)
))

export const pVarType: P<VarType> = p.map(
  p.guard(pIdentifier, id => isLower(id[0])),
  (id): VarType => ({
    sub: 'var',
    id,
  })
)

export const pType: P<Type> = p.alt([
  pFuncType,
  pApplyType,
  pPrimaryType,
])

export type TypeNode<Ex = {}> = Ex & {
  type: 'type'
  val: Type
}

export const pTypeNode = (pSomeType: P<Type>) => pRanged(p.map(pSomeType, val => ({
  type: 'type',
  val,
})))

export const pTermExpr: P<Expr<ExRange>> = pRanged(p.alt([
  pLetExpr,
  pCaseExpr,
  pLambdaCaseExpr,
  pLambdaExpr,
  pCondExpr,
]))

export type AnnExpr<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'ann'
  expr: NodeClass<Ex, C>
  ann: TypeNode<Ex>
}

export const pAnnExpr: P<AnnExpr<ExRange>> = p.map(
  p.ranged(p.seq([pTermExpr, pSpaced(p.str('::')), pTypeNode(pType)])),
  ({ val: [expr, , ann], range }): AnnExpr<ExRange> => ({
    type: 'ann',
    expr,
    ann,
    range,
  })
)

export namespace Pattern {
  export const needsParen = (self: Pattern, parent: Pattern | null): boolean => parent !== null && (
    parent.sub === 'con' && self.sub === 'con' && self.args.length > 0
  )

  export const show = describeToShow<Pattern, Pattern>(
    pattern => pattern,
    (pattern: Pattern, show): string => match(pattern)
      .with({ sub: 'wildcard' }, () => '_')
      .with({ sub: 'num' }, ({ val }) => String(val))
      .with({ sub: 'unit' }, () => '()')
      .with({ sub: 'var' }, ({ var: { id } }) => id)
      .with({ sub: 'con' }, ({ con: { id }, args }) => `${id} ${args.map(show).join(' ')}`)
      .exhaustive(),
    needsParen,
  )
}

export namespace Node {
  export const is = <const Ts extends NodeType[]>(node: Node, types: Ts): node is Node & { type: Ts[number] } => types.includes(node.type)

  export const needsParen = (self: Node, parent: Node | null): boolean => parent !== null && (
    self.type === 'var' && isSymbol(self.id) && parent.type !== 'binOp' ||
    parent.type === 'apply' && (
      self.type === 'lambda' ||
      self.type === 'apply' && self === parent.arg
    )
  )

  export const show = describeToShow<Node, Node>(
    expr => expr,
    (expr, show): string => match(expr)
      .with({ type: 'num' }, expr => String(expr.val))
      .with({ type: 'unit' }, () => '()')
      .with({ type: 'var' }, expr => expr.id)
      .with({ type: 'cond' }, expr =>
        `${show(expr.cond)} ? ${show(expr.yes)} : ${show(expr.no)}`
      )
      .with({ type: 'let' }, expr =>
        `let ${expr.bindings.map(show).join('; ')} in ${show(expr.body)}`
      )
      .with({ type: 'case' }, expr =>
        `case ${show(expr.subject)} of ${expr.branches.map(show).join('; ')}`
      )
      .with({ type: 'caseBranch' }, branch => `${show(branch.pattern)} -> ${show(branch.body)}`)
      .with({ type: 'pattern' }, Pattern.show)
      .with({ type: 'binding' }, binding => `${show(binding.lhs)} = ${show(binding.rhs)}`)
      .with({ type: 'lambda' }, expr =>
        `(\\${show(expr.param)} -> ${show(expr.body)})`
      )
      .with({ type: 'apply' }, expr =>
        `(${show(expr.func)} ${show(expr.arg)})`
      )
      .with({ type: 'binOp' }, expr =>
        `${show(expr.lhs)} ${expr.op.id} ${show(expr.rhs)}`
      )
      .with({ type: 'ann' }, expr =>
        `(${show(expr.expr)} :: ${show(expr.ann)})`
      )
      .with({ type: 'type' }, type => Type.show(type.val))
      .with({ type: 'def' }, def => show(def.binding))
      .with({ type: 'mod' }, ({ defs }) => defs.map(show).join('\n\n'))
      .with({ type: 'lambdaCase' }, expr =>
        `\case ${expr.branches.map(show).join('; ')}`
      )
      .with({ type: 'list' }, expr =>
        `[${expr.elems.map(show).join(', ')}]`
      )
      .with({ type: 'tuple' }, expr =>
        `(${expr.elems.map(show).join(', ')})`
      )
      .with({ type: 'dataDef' }, def =>
        `data ${[def.id, ...def.data.typeParams].join(' ')} = ${
          def.data.cons
            .map(({ id, params }) => `${id}${params.map(param => ` ${Type.show(param)}`).join(' ')}`)
            .join(' | ')
        }`
      )
      .exhaustive(),
    needsParen,
  )
}

export type NodeClassId = '@expr' | '@exprInt' | '@node' | NodeType
export type NodeClass<Ex = {}, C extends NodeClassId = '@node'> =
  C extends '@expr' ? Expr<Ex> :
  C extends '@exprInt' ? ExprInt<Ex> :
  C extends '@node' ? Node<Ex> :
  C extends 'unit' ? UnitExpr<Ex> :
  C extends 'num' ? NumExpr<Ex> :
  C extends 'var' ? VarExpr<Ex> :
  C extends 'let' ? LetExpr<Ex, C> :
  C extends 'case' ? CaseExpr<Ex, C> :
  C extends 'cond' ? CondExpr<Ex, C> :
  C extends 'apply' ? ApplyExpr<Ex, C> :
  C extends 'lambda' ? LambdaExpr<Ex, C> :
  C extends 'ann' ? AnnExpr<Ex, C> :
  C extends 'binOp' ? BinOpExpr<Ex> :
  C extends 'bindind' ? Binding<Ex> :
  C extends 'type' ? TypeNode<Ex> :
  C extends 'caseBranch' ? CaseBranch<Ex> :
  C extends 'pattern' ? Pattern<Ex> :
  C extends 'def' ? Def<Ex> :
  C extends 'mod' ? Mod<Ex> :
  never

export type ExprInt<Ex = {}, C extends NodeClassId = '@exprInt'> =
  | UnitExpr<Ex>
  | NumExpr<Ex>
  | VarExpr<Ex>
  | LetExpr<Ex, C>
  | CaseExpr<Ex, C>
  | CondExpr<Ex, C>
  | ApplyExpr<Ex, C>
  | LambdaExpr<Ex, C>
  | AnnExpr<Ex, C>

export type Expr<Ex = {}> =
  | ExprInt<Ex, '@expr'>
  | BinOpExpr<Ex>
  | LambdaCaseExpr<Ex>
  | ListExpr<Ex>
  | TupleExpr<Ex>

export type Node<Ex = {}> =
  | Expr<Ex>
  | Binding<Ex>
  | TypeNode<Ex>
  | CaseBranch<Ex>
  | Pattern<Ex>
  | Def<Ex>
  | DataDef<Ex>
  | Mod<Ex>

export type ExprType = Expr['type']
export type NodeType = Node['type']

export const pExpr: P<Expr<ExRange>> = p.alt([
  pAnnExpr,
  pTermExpr,
])

export type Def<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'def'
  binding: Binding<Ex, C>
}
export const pDef: P<Def<ExRange>> = pRanged(p.map(
  pBinding,
  binding => ({ type: 'def', binding })
))

export type DataDef<Ex = {}> = Ex & {
  type: 'dataDef'
  id: string
  data: Data
}
export const pDataDef: P<DataDef<ExRange>> = pRanged(p.lazy(() => p.bind(
  p.seq([
    p.str('data'),
    pSpaced(pCon),
    p.many(pSpaced(pVarType)),
    pSpacedAround(p.char('=')),
    p.sep(
      p.alt([pApplyType, pConType]),
      pSpacedAround(p.char('|'))
    ),
  ]),
  ([, { id }, typeParams, , cons]) => p.result(Result
    .all(
      cons.map(con => pipe(
        con,
        uncurryApplyType,
        ([func, ...params]) => func.sub === 'con'
          ? Ok({
            id: func.id,
            params,
          })
          : Err(ParseErr('NotAConstructor', { type: func }))
      ))
    )
    .map((cons): DataDef => ({
      type: 'dataDef',
      id,
      data: {
        typeParams: typeParams.map(({ id }) => id),
        cons,
      }
    }))
  ))
))

export type Class = {
  typeParams: string[]
  defs: Def[]
}
export type ClassDef = {
  type: 'classDef'
  id: string
  class: Class
}
// export const pClassDef: P<ClassDef> = p.lazy(() => p.map(
//   p.seq([
//     p.str('class'),
//     pSpaced(pTypeNode(pConType)),
//     pSpaced(p.str('where')),
//     pBlock(pDef),
//   ]),
//   ([]) => {}
// ))


export type Mod<Ex = {}, C extends NodeClassId = '@expr'> = Ex & {
  type: 'mod'
  defs: Def<Ex, C>[]
  dataDefs: DataDef<Ex>[]
}
export const pMod: P<Mod<ExRange>> =p.map(
  p.ranged(pBlock(p.alt([pDataDef, pDef]))),
  ({ val: defs, range }) => pipe(
    defs,
    groupByProp('type'),
    ({ def: defs = [], dataDef: dataDefs = [] }): Mod<ExRange> => ({
      type: 'mod',
      defs,
      dataDefs,
      range,
    })
  )
)

export const withId = <C extends NodeClassId, Ex>(node: NodeClass<Ex, C>): NodeClass<Ex & ExId, C> => {
  let id = 0

  const traverse = <T extends Node>(node: T): T & ExId => {
    const newNode = { ...node, astId: id ++ }

    switch (newNode.type) {
      case 'num':
      case 'var':
      case 'type':
      case 'unit':
        break
      case 'apply':
        newNode.func = traverse(newNode.func)
        newNode.arg = traverse(newNode.arg)
        break
      case 'binOp':
        newNode.lhs = traverse(newNode.lhs)
        newNode.op = traverse(newNode.op)
        newNode.rhs = traverse(newNode.rhs)
        break
      case 'cond':
        newNode.cond = traverse(newNode.cond)
        newNode.yes = traverse(newNode.yes)
        newNode.no = traverse(newNode.no)
        break
      case 'let':
        newNode.bindings = newNode.bindings.map(traverse)
        newNode.body = traverse(newNode.body)
        break
      case 'case':
        newNode.subject = traverse(newNode.subject)
        newNode.branches = newNode.branches.map(traverse)
        break
      case 'lambda':
        newNode.param = traverse(newNode.param)
        newNode.body = traverse(newNode.body)
        break
      case 'lambdaCase':
        newNode.branches = newNode.branches.map(traverse)
        break
      case 'list':
        newNode.elems = newNode.elems.map(traverse)
        break
      case 'tuple':
        newNode.elems = newNode.elems.map(traverse)
        break
      case 'caseBranch':
        newNode.pattern = traverse(newNode.pattern)
        newNode.body = traverse(newNode.body)
        break
      case 'pattern':
        switch (newNode.sub) {
          case 'num':
          case 'unit':
            break
          case 'con':
            newNode.con = traverse(newNode.con)
            newNode.args = newNode.args.map(traverse)
            break
          case 'var':
            newNode.var = traverse(newNode.var)
            break
        }
        break
      case 'binding':
        newNode.lhs = traverse(newNode.lhs)
        newNode.rhs = traverse(newNode.rhs)
        break
      case 'ann':
        newNode.expr = traverse(newNode.expr)
        newNode.ann = traverse(newNode.ann)
        break
      case 'def':
        newNode.binding = traverse(newNode.binding)
        break
      case 'dataDef':
        break
      case 'mod':
        newNode.defs = newNode.defs.map(traverse)
        newNode.dataDefs = newNode.dataDefs.map(traverse)
        break
    }
    return newNode
  }

  return traverse(node) as NodeClass<Ex & ExId, C>
}

export const ToInternalMap = {
  num: (expr): NumExpr<{}> => expr,
  unit: (expr): UnitExpr<{}> => expr,
  var: (expr): VarExpr<{}> => expr,
  let: (expr): LetExpr<{}, '@exprInt'> => ({
    ...expr,
    bindings: expr.bindings.map(binding => ({
      ...binding,
      rhs: toInternal(binding.rhs),
    })),
    body: toInternal(expr.body),
  }),
  case: (expr): CaseExpr<{}, '@exprInt'> => ({
    ...expr,
    subject: toInternal(expr.subject),
    branches: expr.branches.map(branch => ({
      ...branch,
      body: toInternal(branch.body),
    })),
  }),
  cond: (expr): CondExpr<{}, '@exprInt'> => ({
    ...expr,
    cond: toInternal(expr.cond),
    yes: toInternal(expr.yes),
    no: toInternal(expr.no),
  }),
  apply: (expr): ApplyExpr<{}, '@exprInt'> => ({
    ...expr,
    func: toInternal(expr.func),
    arg: toInternal(expr.arg),
  }),
  lambda: (expr): LambdaExpr<{}, '@exprInt'> => ({
    ...expr,
    body: toInternal(expr.body),
  }),
  ann: (expr): AnnExpr<{}, '@exprInt'> => ({
    ...expr,
    expr: toInternal(expr.expr),
  }),
  binOp: (expr): ApplyExpr<{}, '@exprInt'> => ({
    type: 'apply',
    func: {
      type: 'apply',
      func: { type: 'var', id: expr.op.id },
      arg: toInternal(expr.lhs),
    },
    arg: toInternal(expr.rhs),
  }),
  lambdaCase: (expr): LambdaExpr<{}, '@exprInt'> => ({
    type: 'lambda',
    param: {
      type: 'pattern',
      sub: 'var',
      var: { type: 'var', id: '!subject' },
    },
    body: {
      type: 'case',
      subject: { type: 'var', id: '!subject' },
      branches: expr.branches.map(branch => ({
        ...branch,
        body: toInternal(branch.body),
      })),
    }
  }),
  list: ({ elems, range }): ExprInt => toInternal(elems.reduceRight<Expr<ExRange>>(
    (tail, head) => ApplyExprCurried(
      { type: 'var', id: '#', range: Range.inner(head.range, tail.range) },
      [head, tail],
      Range.outer(head.range, tail.range),
    ),
    { type: 'var', id: '[]', range }
  )),
  tuple: ({ elems, range }): ExprInt => toInternal(ApplyExprCurried(
    { type: 'var', id: `${','.repeat(elems.length - 1)}`, range },
    elems,
    range,
  ))
} satisfies {
  [K in ExprType]: (expr: Expr<ExRange> & { type: K }) => ExprInt<{}, '@exprInt'>
}
export type ToInternalMap = typeof ToInternalMap

export type ToInternal<K extends ExprType> = ReturnType<ToInternalMap[K]>
export const toInternal = <K extends ExprType>(expr: Expr & { type: K }): ToInternal<K> => {
  const map = ToInternalMap[expr.type] as unknown as (expr: Expr & { type: K }) => ToInternal<K>
  return map(expr)
}

export const toInternalMod = (mod: Mod): Mod<{}, '@exprInt'> => ({
  ...mod,
  defs: mod.defs.map(def => ({
    ...def,
    binding: {
      ...def.binding,
      rhs: toInternal(def.binding.rhs),
    },
  })),
})

export const parseExpr = (input: string) =>
  p.map(p.ended(pSpacedAround(pExpr)), withId<'@expr', ExRange>)({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)

export const parseMod = (input: string) =>
  p.map(p.ended(pSpacedAround(pMod)), withId<'mod', ExRange>)({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)