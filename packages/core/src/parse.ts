import { Err, Ok, Result } from 'fk-result'
import { p, ParseErr, Parser, ParserState, Range } from 'parsecond'
import { groupByProp, pipe } from 'remeda'
import { ApplyType, ApplyTypeMulti, ConType, FuncType, Type, extractApplyType, VarType, TypeScheme } from './type'
import {
  DRange, DId,
  NumExpr, TupleExprAuto, UnitExpr, VarExpr, ListExpr, ApplyExpr, InfixExpr, CondExpr, Binding, LetExpr,
  WildcardPattern, NumPattern, UnitPattern, ConPattern, VarPattern, CaseBranch, CaseExpr, LambdaCaseExpr,
  AnnExpr, BindingDef, Mod, DataDecl, Pattern, ApplyMultiExpr, RollExpr, TuplePattern, ListPattern,
  LambdaMultiExpr, Decl, FixityDecl, SectionLExpr, SectionRExpr, ParenExpr, ImportDecl, ExprDes, NodeRaw,
  ExprRaw, ExprRawType, Equation, EquationDef, withId,
  BindingHost,
  CharExpr,
  StrExpr,
  ClassDef,
  InstanceDef,
} from './node'
import { isLower, isUpper, RESERVED_SYMBOLS, RESERVED_WORDS, SYMBOL_CHARS } from './lex'
import { generalize } from './infer'

declare module 'parsecond' {
  export interface ParseErrMap {
    IsReservedWord: {
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

const pWhite = p.many(
  p.notEmpty(p.join(p.seq([
    p.join(p.many(p.char(' '))),
    p.alt([
      p.join(p.seq([p.str('--'), p.join(p.many(p.noneOf('\n')))])),
      p.pure(''),
    ]),
    p.join(p.many(p.char('\n'))),
  ])))
)

const pLayoutBegin = <T, E>(parser: Parser<T, E>): Parser<T, E> =>
  p.bind(
    pWhite,
    () => state => parser({ ...state, layout: [getCol(state), ...state.layout] }),
  )

const pLayout = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.bindValState(
  pWhite,
  (({ state, val }) => {
    if (val.length && state.rest && getCol(state) <= state.layout[0]) return p.fail(null)
    return parser
  })
)

const pLayoutAligned = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.bindValState(
  pWhite,
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

const pRanged = <T extends NodeRaw, E>(parser: Parser<T, E>): Parser<T & DRange, E> =>
  oldState => parser(oldState).map(({ val, state }) => ({
    val: {
      ...val,
      range: {
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

export const pCharInner = (quote: '\'' | '"'): P<string> => p.alt([
  p.map(p.str('\\n'), () => '\n'),
  p.map(p.str('\\r'), () => '\r'),
  p.map(p.str('\\t'), () => '\t'),
  p.map(p.str('\\' + quote), () => quote),
  p.map(p.str('\\\\'), () => '\\'),
  p.map(p.right(p.str('\\u'))(p.regex(/[0-9a-fA-F]{4}/)), hex => String.fromCodePoint(parseInt(hex, 16))),
  p.noneOf('\n\\' + quote),
])

export const pChar: P<CharExpr<DRange>> = pRanged(p.map(
  p.delimitedBy(p.char('\''), p.char('\''))(pCharInner('\'')),
  val => ({ type: 'char', val }),
))

export const pStr: P<StrExpr<DRange>> = pRanged(p.map(
  p.delimitedBy(p.char('"'), p.char('"'))(p.join(p.many(pCharInner('"')))),
  val => ({ type: 'str', val }),
))

export const pIdent: P<string> = p.bind(
  p.regex(/[A-Za-z][A-Za-z\d']*|_[A-Za-z\d']+/),
  id => p.result(RESERVED_WORDS.includes(id)
    ? Err(ParseErr('IsReservedWord', { word: id }))
    : Ok(id)
  )
)
export const pIdentBig = p.guard(pIdent, id => isUpper(id[0]))
export const pIdentSmall = p.guard(pIdent, id => isLower(id[0]))

export const pSymbol: P<string> = p.bind(
  p.join(p.some(p.oneOf(SYMBOL_CHARS))),
  id => p.result(RESERVED_SYMBOLS.includes(id)
    ? Err(ParseErr('IsReservedWord', { word: id }))
    : Ok(id)
  )
)
export const pSymbolOrComma: P<string> = p.alt([pSymbol, p.join(p.some(p.char(',')))])

export const pSymbolVar: P<VarExpr<DRange>> = pRanged(p.map(
  pSymbol,
  id => ({ type: 'var', id })
))

export const pSymbolOrCommaVar: P<VarExpr<DRange>> = pRanged(p.map(
  pSymbolOrComma,
  id => ({ type: 'var', id }))
)

export const pTupleExprInner: P<TupleExprAuto<DRange>> = p.lazy(() => pRanged(p.bind(
  p.sep2(pExpr, pSpacedAround(p.char(','))),
  (elems) => p.result(
    elems.length > 4 ? Err(ParseErr('TooLargeTuple', { size: elems.length })) :
    Ok({ type: 'tuple', elems })
  )
)))

export const pUnitExprInner: P<UnitExpr<DRange>> = pRanged(p.pure({ type: 'unit' }))


export const pParenExprInner: P<ParenExpr<DRange>> = p.lazy(() => pRanged(p.map(
  pExpr,
  expr => ({ type: 'paren', expr })
)))

export const pParenExpr: P<ExprRaw<DRange>> = p.lazy(() => pRanged(p.parens(
  pSpacedAround(p.alt([
    pTupleExprInner,
    pSectionLExprInner,
    pSectionRExprInner,
    pSymbolOrCommaVar,
    pParenExprInner,
    pUnitExprInner,
  ]))
)))

export const pListExpr: P<ListExpr<DRange>> = p.lazy(() => pRanged(p.map(
  p.brackets(pSpacedAround(
    p.sep0(pExpr, pSpacedAround(p.char(','))),
  )),
  (elems) => ({
    type: 'list',
    elems,
  })
)))

export const pPrimaryExpr: P<ExprRaw<DRange>> = p.lazy(() => p.alt([
  pParenExpr,
  pListExpr,
  pNum,
  pVar,
  pCon,
  pChar,
  pStr,
]))

export const pVar: P<VarExpr<DRange>> = pRanged(p.map(
  pIdentSmall,
  id => ({ type: 'var', id })
))
export const pCon: P<VarExpr<DRange>> = pRanged(p.map(
  pIdentBig,
  id => ({ type: 'var', id })
))

export const pVarOrSymbolVar: P<VarExpr<DRange>> = p.alt([pVar, pSymbolVar])

export const pVarDelimited = p.alt([pVar, p.parens(p.alt([pVar, pSymbolVar]))])

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

export const extractApplyExpr = (expr: ApplyExpr<DRange, 'des'>): ExprDes<DRange>[] => expr.func.type === 'apply'
  ? [...extractApplyExpr(expr.func), expr.arg]
  : [expr.func, expr.arg]

export const extractMaybeInfixOp = (expr: ExprDes) => {
  if (expr.type === 'apply' && expr.func.type === 'apply' && expr.func.func.type === 'var' && expr.func.func.isInfix)
    return expr.func.func.id
  return null
}

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

export const pInfixExpr: P<InfixExpr<DRange>> = pRanged(p.map(
  p.seq([
    pApplyExprL,
    p.some(p.seq([pSpacedAround(pSymbolVar), pApplyExprL])),
  ]),
  ([head, tail]) => pipe(
    tail.reduce<{
      ops: VarExpr<DRange>[],
      args: ExprRaw<DRange>[]
    }>(
      ({ ops, args }, [op, arg]) => ({
        ops: [...ops, op],
        args: [...args, arg],
      }),
      { ops: [], args: [head] }
    ),
    ({ ops, args }) => ({
      type: 'infix',
      ops,
      args,
    })
  )
))
export const pInfixExprL = p.lazy(() => p.alt([pInfixExpr, pApplyExprL]))

export const pSectionLExprInner: P<SectionLExpr<DRange>> = pRanged(p.map(
  p.seq([pInfixExprL, pSpaced(pSymbolOrCommaVar)]),
  ([arg, op]) => ({
    type: 'sectionL',
    op,
    arg,
  })
))

export const pSectionRExprInner: P<SectionRExpr<DRange>> = pRanged(p.map(
  p.seq([pSymbolOrCommaVar, pSpaced(pInfixExprL)]),
  ([op, arg]) => ({
    type: 'sectionR',
    op,
    arg,
  })
))

export const pCondExpr: P<ExprRaw<DRange>> = p.lazy(() => p.map(
  p.seq([
    pInfixExprL,
    p.many(p.map(
      p.seq([
        pSpacedAround(p.str('?')),
        pInfixExprL,
        pSpacedAround(p.char(':')),
        pInfixExprL,
      ]),
      ([, yes, , no]): [ExprRaw<DRange>, ExprRaw<DRange>] => [yes, no]
    ))
  ]),
  seq => pipe(reverseSeq(seq), ([head, tail]) =>
    tail.reduce<ExprRaw<DRange>>(
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

export const pEquation: P<Equation<DRange>> = pRanged(p.lazy(() => p.map(
  p.seq([
    pVarDelimited,
    p.some(pSpaced(pPattern)),
    pSpacedAround(p.char('=')),
    pExpr,
  ]),
  ([var_, params, , rhs]) => ({
    type: 'equation',
    var: var_,
    params,
    rhs,
  })
)))

export const pBindingHost = (abstract: boolean): P<BindingHost<DRange>> => p.lazy(() => p.map(
  p.ranged(pBlock(p.alt([pDecl, pFixityDecl, pBindingDef, pEquationDef]))),
  ({ val: defs, range }): BindingHost<DRange> => pipe(
    defs,
    groupByProp('type'),
    ({
      decl: decls = [],
      fixityDecl: fixityDecls = [],
      equationDef: equationDefs = [],
      bindingDef: bindingDefs = [],
    }): BindingHost<DRange> => ({
      type: 'bindingHost',
      abstract,
      decls,
      fixityDecls,
      equationDefs,
      bindingDefs,
      range,
    })
  )
))

export const pClassDef: P<ClassDef<DRange>> = pRanged(p.lazy(() => p.map(
  p.seq([
    p.str('class'),
    pSpaced(pIdentBig),
    pSpaced(pVarType),
    pSpaced(p.str('where')),
    pBindingHost(true),
  ]),
  ([, id, param, , bindingHost]) => ({
    type: 'classDef',
    id,
    param,
    bindingHost,
  })
)))

export const pInstanceDef: P<InstanceDef<DRange>> = pRanged(p.lazy(() => p.map(
  p.seq([
    p.str('instance'),
    pSpaced(pIdentBig),
    pSpaced(pType),
    pSpaced(p.str('where')),
    pBindingHost(false),
  ]),
  ([, classId, arg, , bindingHost]) => ({
    type: 'instanceDef',
    classId,
    arg,
    bindingHost,
  })
)))

export const pLetExpr: P<LetExpr<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([
    p.str('let'),
    pBindingHost(false),
    pSpacedAround(p.str('in')),
    pExpr,
  ])),
  ({ val: [, bindingHost, , body], range }): LetExpr<DRange> => ({
    type: 'let',
    bindingHost,
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

export const pConPattern: P<Pattern<DRange>> = p.lazy(() => pRanged(p.map(
  pCon,
  con => ({
    type: 'pattern',
    sub: 'con',
    con,
    args: [],
  })
)))

export const pApplyPatternInner: P<ConPattern<DRange>> = p.lazy(() => pRanged(p.map(
  p.seq([pCon, p.some(pSpaced(pPattern))]),
  ([con, args]) => ({
    type: 'pattern',
    sub: 'con',
    con,
    args,
  }))
))

export const pApplyPattern: P<ConPattern<DRange>> = p.parens(pSpacedAround(pApplyPatternInner))

export const pListPattern: P<ListPattern<DRange>> = p.lazy(() => pRanged(p.map(
  p.brackets(
    p.sep0(pPattern, pSpacedAround(p.char(','))),
  ),
  (elems) => ({
    type: 'pattern',
    sub: 'list',
    elems,
  })
)))

export const pTuplePatternInner: P<TuplePattern<DRange>> = p.lazy(() => pRanged(p.bind(
  p.sep2(p.alt([pConsPatternInner, pPrimaryPattern]), pSpacedAround(p.char(','))),
  (elems) => p.result(
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
  pApplyPattern,
  pConPattern,
  pNumPattern,
  pUnitPattern,
])

export const pPrimaryPatternInner: P<Pattern<DRange>> = p.alt([
  pParenPattern,
  pListPattern,
  pVarPattern,
  pWildcardPattern,
  pApplyPatternInner,
  pConPattern,
  pNumPattern,
  pUnitPattern,
])

export const pConsPatternInner: P<Pattern<DRange>> = p.lazy(() => p.map(
  p.ranged(p.seq([pPrimaryPattern, p.ranged(pSpacedAround(p.char('#'))), pPattern])),
  ({ val: [head, sharp, tail], range }): ConPattern<DRange> => ({
    type: 'pattern',
    sub: 'con',
    con: { type: 'var', id: '#', range: sharp.range },
    args: [head, tail],
    range,
  })
))

export const pConsPattern: P<Pattern<DRange>> = p.parens(pSpacedAround(pConsPatternInner))

export const pPatternInner: P<Pattern<DRange>> = p.alt([
  pConsPatternInner,
  pPrimaryPattern
])

export const pPattern: P<Pattern<DRange>> = p.alt([
  pConsPattern,
  pPrimaryPattern
])

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
  p.guard(pIdent, id => isUpper(id[0])),
  ConType,
)

export const pListType: P<Type> = p.lazy(() => p.map(
  p.brackets(pSpacedAround(p.opt(pType))),
  elem => elem === null
    ? ConType('[]')
    : ApplyType(ConType('[]'), elem)
))

export const pTupleTypeInner: P<Type> = p.lazy(() => p.map(
  p.sep2(pType, pSpacedAround(p.char(','))),
  elems => ApplyTypeMulti(ConType(`${','.repeat(elems.length - 1)}`), ...elems)
))

export const pUnitTypeInner: P<Type> = p.pure(ConType(''))

export const pParenType: P<Type> = p.lazy(() => p.parens(p.alt([
  pTupleTypeInner,
  pType,
  pUnitTypeInner,
])))

export const pPrimaryType: P<Type> = p.lazy(() => p.alt([
  pListType,
  pParenType,
  pConType,
  pVarType,
]))

export const pApplyType: P<Type> = p.lazy(() => p.map(
  p.seq([
    p.alt([pConType, pVarType]),
    p.some(pSpaced(pPrimaryType)),
  ]),
  ([func, args]) => ApplyTypeMulti(func, ...args)
))

export const pFuncType: P<FuncType> = p.lazy(() => p.map(
  p.seq([p.alt([pApplyType, pPrimaryType]), pSpacedAround(p.str('->')), pType]),
  ([param, , ret]) => FuncType(param, ret)
))

export const pVarType: P<VarType> = p.map(
  p.guard(pIdent, id => isLower(id[0])),
  VarType,
)

export const pType: P<Type> = p.alt([
  pFuncType,
  pApplyType,
  pPrimaryType,
])

export const pTypeNode = (pSomeType: P<Type>) => pRanged(p.map(pSomeType, type => ({
  type: 'typeNode',
  typeScheme: pipe(
    type,
    Type.rigidify,
    generalize,
  ),
})))

export const pTermExpr: P<ExprRaw<DRange>> = pRanged(p.alt([
  pLetExpr,
  pCaseExpr,
  pLambdaCaseExpr,
  pLambdaMultiExpr,
  pCondExpr,
]))

export const pAnnExpr: P<AnnExpr<DRange>> = pRanged(p.map(
  p.seq([pTermExpr, pSpacedAround(p.str('::')), pTypeNode(pType)]),
  ([expr, , ann]) => ({
    type: 'ann',
    expr,
    ann,
  })
))

export const pExpr: P<ExprRaw<DRange>> = p.alt([
  pAnnExpr,
  pTermExpr,
])

export const pBindingDef: P<BindingDef<DRange>> = pRanged(p.map(
  pBinding,
  binding => ({ type: 'bindingDef', binding })
))

export const pEquationDef: P<EquationDef<DRange>> = pRanged(p.map(
  pEquation,
  equation => ({ type: 'equationDef', equation })
))

export const pDecl: P<Decl<DRange>> = pRanged(p.map(
  p.seq([
    p.sep1(pVarDelimited, pSpacedAround(p.char(','))),
    pSpacedAround(p.str('::')),
    pTypeNode(pType),
  ]),
  ([vars, , ann]) => ({
    type: 'decl',
    vars,
    ann,
  })
))

export const pFixityDecl: P<FixityDecl<DRange>> = pRanged(p.map(
  p.seq([
    p.str('infix'),
    p.opt(p.oneOf('lr')),
    pSpaced(p.posint),
    pSpaced(p.sep1(pSymbolVar, pSpacedAround(p.char(',')))),
  ]),
  ([, assocChar, prec, vars]) => ({
    type: 'fixityDecl',
    assoc: assocChar === 'l' ? 'left' : assocChar === 'r' ? 'right' : 'none',
    prec,
    vars,
  })
))

export const pDataDecl: P<DataDecl<DRange>> = pRanged(p.lazy(() => p.bind(
  p.seq([
    p.str('data'),
    pSpaced(pCon),
    p.many(pSpaced(pVarType)),
    pSpacedAround(p.char('=')),
    p.sep1(
      p.alt([pApplyType, pConType]),
      pSpacedAround(p.char('|'))
    ),
  ]),
  ([, { id }, typeParams, , cons]) => p.result(Result
    .all(
      cons.map(con => pipe(
        con,
        extractApplyType,
        ([func, ...params]) => func.sub === 'con'
          ? Ok({
            id: func.id,
            params,
          })
          : Err(ParseErr('NotAConstructor', { type: func }))
      ))
    )
    .map((cons): DataDecl => ({
      type: 'dataDecl',
      id,
      data: {
        id,
        typeParams,
        cons,
      }
    }))
  ))
))

export const pImport: P<ImportDecl<DRange>> = pRanged(p.map(
  p.seq([
    p.str('import'),
    pSpaced(pIdentBig),
    p.opt(pSpaced(p.parens(pSpacedAround(p.map(
      p.sep0(
        p.alt([pVar, pCon, p.parens(pSymbolOrCommaVar)]),
        pSpacedAround(p.char(',')),
      ),
      ids => ids.map(({ id }) => id),
    ))))),
  ]),
  ([, modId, ids]) => ({
    type: 'import',
    modId,
    ids,
  })
))

export const pMod: P<Mod<DRange>> = p.map(
  p.ranged(pBlock(p.alt([
    pImport,
    pDataDecl,
    pClassDef,
    pInstanceDef,

    pDecl,
    pFixityDecl,
    pBindingDef,
    pEquationDef,
  ]))),
  ({ val: defs, range }) => pipe(
    defs,
    groupByProp('type'),
    ({
      import: imports = [],
      dataDecl: dataDecls = [],
      classDef: classDefs = [],
      instanceDef: instanceDefs = [],
      decl: decls = [],
      fixityDecl: fixityDecls = [],
      equationDef: equationDefs = [],
      bindingDef: bindingDefs = [],
    }): Mod<DRange> => ({
      type: 'mod',
      imports,
      dataDecls,
      classDefs,
      instanceDefs,
      bindingHost: {
        type: 'bindingHost',
        abstract: false,
        decls,
        fixityDecls,
        equationDefs,
        bindingDefs,
        range,
      },
      range,
    })
  )
)

export type LayoutParser<T> = (input: string) => PRes<T>
export const runLayoutParser = <T>(parser: P<T>): LayoutParser<T> =>
  input => p.ended(pSpacedAround(parser))({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)

export const parseExpr: LayoutParser<ExprRaw<DRange & DId>> = runLayoutParser(p.map(pExpr, withId<ExprRawType, DRange>))

export const parseMod: LayoutParser<Mod<DRange & DId>> = runLayoutParser(p.map(pMod, withId<'mod', DRange>))
