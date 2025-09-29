import { Err, Ok, Result } from 'fk-result'
import { p, ParseErr, Parser, ParserState, Range } from 'parsecond'
import { groupByProp, pipe } from 'remeda'
import { ApplyTypeCurried, ConType, FuncType, Type, uncurryApplyType, VarType } from './types'
import { unsnoc } from './utils'
import {
  DRange, DId,
  NumExpr, TupleExpr, UnitExpr, VarExpr, Expr, ListExpr, ApplyExpr, BinOpExpr,
  CondExpr, Binding, LetExpr, WildcardPattern, NumPattern, UnitPattern, ConPattern, VarPattern,
  CaseBranch, CaseExpr, LambdaExpr, LambdaCaseExpr, AnnExpr, Def, Mod, DataDef, Node, Pattern,
  ApplyMultiExpr, RollExpr,
  withId,
  ExprType,
  TuplePattern,
  ListPattern,
  LambdaMultiExpr,
  Decl
} from './nodes'
import { isLower, isUpper, SYMBOL_CHARS } from './lex'

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

export namespace Parse {
  export type Err = ParseErr | null
}

export type P<T> = Parser<T, ParseErr | null>
export type PRes<T> = Result<T, ParseErr | null>

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

const pRanged = <T extends Node, E>(parser: Parser<T, E>): Parser<T & DRange, E> =>
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


export const pNum: P<NumExpr<DRange>> = pRanged(p.map(p.decimal, val => ({
  type: 'num',
  val,
})))

export const RESERVE_WORDS = [ 'let', 'in', 'case', 'of', 'data', 'class', 'where' ]
export const pIdentifier: P<string> = p.bind(
  p.notEmpty(p.regex(/[A-Za-z][A-Za-z\d']*|_[A-Za-z\d']+/)),
  id => p.result(RESERVE_WORDS.includes(id)
    ? Err(ParseErr('IsReserveWord', { word: id }))
    : Ok(id)
  )
)

export const pSymbol: P<string> = p.join(p.some(p.oneOf(SYMBOL_CHARS)))
export const pSymbolOrComma: P<string> = p.alt([pSymbol, p.join(p.some(p.char(',')))])

export const pSymbolVar: P<VarExpr<DRange>> = pRanged(p.map(
  pSymbol,
  id => ({ type: 'var', id })
))

export const pTupleExprInner: P<TupleExpr<DRange>> = p.lazy(() => pRanged(p.bind(
  p.sep(pExpr, pSpacedAround(p.char(','))),
  (elems) => p.result(
    elems.length < 2 ? Err(null) :
    elems.length > 4 ? Err(ParseErr('TooLargeTuple', { size: elems.length })) :
    Ok({ type: 'tuple', elems })
  )
)))

export const pUnitExprInner: P<UnitExpr<DRange>> = pRanged(p.pure({ type: 'unit' }))

export const pSymbolVarExprInner: P<VarExpr<DRange>> = pRanged(p.map(pSymbolOrComma, (id): VarExpr => ({ type: 'var', id })))

export const pParenExpr: P<Expr<DRange>> = p.parens(
  pSpacedAround(p.alt([
    pTupleExprInner,
    p.lazy(() => pExpr),
    pSymbolVarExprInner,
    pUnitExprInner,
  ]))
)

export const pListExpr: P<ListExpr<DRange>> = p.lazy(() => pRanged(p.map(
  p.brackets(pSpacedAround(p.alt([
    p.sep(pExpr, pSpacedAround(p.char(','))),
    p.pure<Expr<DRange>[]>([]),
  ]))),
  (elems) => ({
    type: 'list',
    elems,
  })
)))

export const pPrimaryExpr: P<Expr<DRange>> = p.lazy(() => p.alt([
  pParenExpr,
  pListExpr,
  pNum,
  pVar,
  pCon,
]))

export const pVar: P<VarExpr<DRange>> = pRanged(p.map(
  p.guard(pIdentifier, id => ! isUpper(id[0])),
  id => ({ type: 'var', id })
))
export const pCon: P<VarExpr<DRange>> = pRanged(p.map(
  p.guard(pIdentifier, id => isUpper(id[0])),
  id => ({ type: 'var', id })
))

export const pRollExpr: P<RollExpr<DRange>> = p.map(
  p.ranged(p.seq([
    p.opt(pPrimaryExpr),
    p.char('@'),
    pPrimaryExpr,
  ])),
  ({ val: [times, , sides], range }) => ({
    type: 'roll',
    times,
    sides,
    range,
  })
)

export const pRollExprL = p.alt([pRollExpr, pPrimaryExpr])

export const ApplyExprCurried = (func: Expr, args: Expr[]): ApplyExpr => (args.length
  ? pipe(
    unsnoc(args),
    ([args, arg]) => ({
      type: 'apply',
      func: ApplyExprCurried(func, args),
      arg,
    })
  )
  : func
) as ApplyExpr

export const uncurryApplyExpr = (expr: ApplyExpr<DRange>): Expr<DRange>[] => expr.func.type === 'apply'
    ? [...uncurryApplyExpr(expr.func), expr.arg]
    : [expr.func, expr.arg]

export const pApplyExpr: P<ApplyMultiExpr<DRange>> = pRanged(p.lazy(() => p.map(
  p.seq([
    p.alt([pVar, pCon, pParenExpr]),
    p.some(pSpaced(pRollExprL))
  ]),
  ([func, args]) => ({
    type: 'applyMulti',
    func,
    args,
  })
)))
export const pApplyExprL = p.lazy(() => p.alt([pApplyExpr, pRollExprL, pLetExpr, pCaseExpr]))

export type Assoc = 'left' | 'right' | 'none'
export type Fixity = {
  prec: number
  assoc: Assoc
}

export namespace Fixity {
  export const of = (prec: number, assoc: Assoc): Fixity => ({
    prec,
    assoc,
  })

  export const def = () => of(9, 'left')

  export const show = ({ assoc, prec }: Fixity): string => 
    `infix${assoc === 'none' ? '' : assoc[0]} ${prec}`
}
export type FixityTable = Record<string, Fixity>

export const builtinFixityTable: FixityTable = {
  '.': Fixity.of(9, 'right'),
  '^': Fixity.of(8, 'right'),
  '*': Fixity.of(7, 'left'),
  '/': Fixity.of(7, 'left'),
  '%': Fixity.of(7, 'left'),
  '+': Fixity.of(6, 'left'),
  '-': Fixity.of(6, 'left'),
  '++': Fixity.of(5, 'right'),
  '#': Fixity.of(5, 'right'),
  '==': Fixity.of(4, 'none'),
  '!=': Fixity.of(4, 'none'),
  '<': Fixity.of(4, 'none'),
  '<=': Fixity.of(4, 'none'),
  '>': Fixity.of(4, 'none'),
  '>=': Fixity.of(4, 'none'),
  '&&': Fixity.of(3, 'right'),
  '||': Fixity.of(2, 'right'),
  '|>': Fixity.of(1, 'left'),
  '$': Fixity.of(0, 'right'),
}

export const pBinOpExpr: P<BinOpExpr<DRange>> = pRanged(p.map(
  p.seq([
    pApplyExprL,
    p.many(p.seq([pSpacedAround(pSymbolVar), pApplyExprL])),
  ]),
  ([head, tail]) => pipe(
    tail.reduce<{
      ops: VarExpr<DRange>[],
      args: Expr<DRange>[]
    }>(
      ({ ops, args }, [op, arg]) => ({
        ops: [...ops, op],
        args: [...args, arg],
      }),
      { ops: [], args: [head] }
    ),
    ({ ops, args }) => ({
      type: 'binOp',
      ops,
      args,
    })
  )
))

export const pCondExpr: P<Expr<DRange>> = p.lazy(() => p.map(
  p.seq([
    pBinOpExpr,
    p.many(p.map(
      p.seq([
        pSpacedAround(p.char('?')),
        pBinOpExpr,
        pSpacedAround(p.char(':')),
        pBinOpExpr,
      ]),
      ([, yes, , no]): [Expr<DRange>, Expr<DRange>] => [yes, no]
    ))
  ]),
  seq => pipe(reverseSeq(seq), ([head, tail]) =>
    tail.reduce<Expr<DRange>>(
      (no, [yes, cond]): CondExpr<DRange> => ({
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

export const pBinding: P<Binding<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([pPattern, pSpacedAround(p.char('=')), pExpr])),
  ({ val: [lhs, , rhs], range }): Binding<DRange> => ({
    type: 'binding',
    lhs,
    rhs,
    range,
  })
))

export const pLetExpr: P<LetExpr<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.str('let'),
    pBlock(pBinding),
    pSpacedAround(p.str('in')),
    pExpr,
  ])),
  ({ val: [, bindings, , body], range }): LetExpr<DRange> => ({
    type: 'let',
    bindings,
    body,
    range,
  })
))

export const pWildcardPattern: P<WildcardPattern<DRange>> = pRanged(p.map(p.char('_'), () => ({
  type: 'pattern',
  sub: 'wildcard',
})))

export const pNumPattern: P<NumPattern<DRange>> = pRanged(p.map(pNum, ({ val }) => ({
  type: 'pattern',
  sub: 'num',
  val,
})))

export const pUnitPattern: P<UnitPattern<DRange>> = pRanged(
  p.parens(pSpaced(p.pure({ type: 'pattern', sub: 'unit' })))
)

export const pConPattern: P<ConPattern<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    pCon,
    p.many(pSpaced(pPattern)),
  ])),
  ({ val: [con, args], range }): ConPattern<DRange> => ({
    type: 'pattern',
    sub: 'con',
    con,
    args,
    range,
  })
))

export const pListPattern: P<ListPattern<DRange>> = p.lazy(() => pRanged(p.map(
  p.brackets(p.alt([
    p.sep(pPattern, pSpacedAround(p.char(','))),
    p.pure<Pattern<DRange>[]>([]),
  ])),
  (elems) => ({
    type: 'pattern',
    sub: 'list',
    elems,
  })
)))

export const pTuplePatternInner: P<TuplePattern<DRange>> = p.lazy(() => pRanged(p.bind(
  p.sep(pPattern, pSpacedAround(p.char(','))),
  (elems) => p.result(
    elems.length < 2 ? Err(null) :
    elems.length > 4 ? Err(ParseErr('TooLargeTuple', { size: elems.length })) :
    Ok({ type: 'pattern', sub: 'tuple', elems })
  )
)))

export const pParenPattern: P<Pattern<DRange>> = p.lazy(() => p.parens(pSpacedAround(p.alt([
  pTuplePatternInner,
  pSymbolVarPatternInner,
  pPattern,
]))))

export const pVarPattern: P<VarPattern<DRange>> = p.map(pVar, (var_) => ({
  type: 'pattern',
  sub: 'var',
  var: var_,
  range: var_.range,
}))

export const pSymbolVarPatternInner: P<VarPattern<DRange>> = p.map(pSymbolVar, (var_) => ({
  type: 'pattern',
  sub: 'var',
  var: var_,
  range: var_.range,
}))

export const pPrimaryPattern: P<Pattern<DRange>> = p.alt([
  pParenPattern,
  pListPattern,
  pVarPattern,
  pWildcardPattern,
  pConPattern,
  pNumPattern,
  pUnitPattern,
])

export const pConsPattern: P<Pattern<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([pPrimaryPattern, p.ranged(pSpacedAround(p.char('#'))), pPattern])),
  ({ val: [head, sharp, tail], range }): ConPattern<DRange> => ({
    type: 'pattern',
    sub: 'con',
    con: { type: 'var', id: '#', range: sharp.range },
    args: [head, tail],
    range,
  })
))

export const pPattern: P<Pattern<DRange>> = p.alt([pConsPattern, pPrimaryPattern])

export const pCaseBranch: P<CaseBranch<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    pPattern,
    pSpacedAround(p.str('->')),
    pExpr,
  ])),
  ({ val: [pattern, , body], range }): CaseBranch<DRange> => ({
    type: 'caseBranch',
    pattern,
    body,
    range,
  })
))

export const pCaseExpr: P<CaseExpr<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.str('case'),
    pSpaced(pExpr),
    pSpacedAround(p.str('of')),
    pBlock(pCaseBranch),
  ])),
  ({ val: [, subject, , cases], range }): CaseExpr<DRange> => ({
    type: 'case',
    subject,
    branches: cases,
    range,
  }))
)

export const LambdaExprCurried = ([param, ...params]: Pattern[], body: Expr): LambdaExpr => ({
  type: 'lambda',
  param,
  body: ! params.length
    ? body
    : LambdaExprCurried(params, body),
})

export const pLambdaMultiExpr: P<LambdaMultiExpr<DRange>> = p.lazy(() => pRanged(p.map(
  p.seq([
    p.char('\\'),
    p.some(pSpaced(pPattern)),
    pSpacedAround(p.str('->')),
    pExpr,
  ]),
  ([, params, , body]) => ({
    type: 'lambdaMulti',
    params,
    body,
  })
)))

export const pLambdaCaseExpr: P<LambdaCaseExpr<DRange>> = p.lazy(() => pRanged(p.map(
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

export const pTypeNode = (pSomeType: P<Type>) => pRanged(p.map(pSomeType, val => ({
  type: 'typeNode',
  val,
})))

export const pTermExpr: P<Expr<DRange>> = pRanged(p.alt([
  pLetExpr,
  pCaseExpr,
  pLambdaCaseExpr,
  pLambdaMultiExpr,
  pCondExpr,
]))

export const pAnnExpr: P<AnnExpr<DRange>> = pRanged(p.map(
  p.seq([pTermExpr, pSpaced(p.str('::')), pTypeNode(pType)]),
  ([expr, , ann]) => ({
    type: 'ann',
    expr,
    ann,
  })
))

export const pExpr: P<Expr<DRange>> = p.alt([
  pAnnExpr,
  pTermExpr,
])

export const pDef: P<Def<DRange>> = pRanged(p.map(
  pBinding,
  binding => ({ type: 'def', binding })
))

export const pDecl: P<Decl<DRange>> = pRanged(p.map(
  p.seq([
    p.sep(p.alt([pVar, p.parens(pSymbolVarExprInner)]), pSpacedAround(p.char(','))),
    pSpacedAround(p.str('::')),
    pTypeNode(pType),
  ]),
  ([vars, , ann]) => ({
    type: 'decl',
    vars,
    ann,
  })
))

export const pDataDef: P<DataDef<DRange>> = pRanged(p.lazy(() => p.bind(
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

export const pMod: P<Mod<DRange>> =p.map(
  p.ranged(pBlock(p.alt([pDecl, pDef, pDataDef]))),
  ({ val: defs, range }) => pipe(
    defs,
    groupByProp('type'),
    ({ def: defs = [], dataDef: dataDefs = [], decl: decls = [] }): Mod<DRange> => ({
      type: 'mod',
      defs,
      decls,
      dataDefs,
      range,
    })
  )
)

export const parseExpr = (input: string): PRes<Expr<DRange & DId>> =>
  p.map(p.ended(pSpacedAround(pExpr)), withId<ExprType, DRange>)({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)

export const parseMod = (input: string): PRes<Mod<DRange & DId>> =>
  p.map(p.ended(pSpacedAround(pMod)), withId<'mod', DRange>)({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)