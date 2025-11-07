import { Err, Ok, Result } from 'fk-result'
import { p, ParseErr, Parser, ParserState } from 'parsecond'

import * as R from 'remeda'
import { pipe } from '@/utils/compose'
import { ApplyType, ApplyTypeMulti, Constr, Constrs, ConType, FuncType, Type, TypeScheme, VarType } from '@/type/type'
import { isLower, isUpper, RESERVED_SYMS, RESERVED_WORDS, SYM_CHARS } from '@/lex'
import {
  NumExpr, Node, NodeHead, CharExpr, StrExpr, VarExpr, TupleExpr, UnitExpr, ParenExpr,
  Expr, ListExpr, RollExpr, ApplyMultiExpr, InfixExpr, SectionLExpr, SectionRExpr, CondExpr, BindingNode,
  EquationNode, EquationHeadNode, EquationApplyHeadNode, BindingHostNode, TypeSchemeNode, TypeNode,
  AnnExpr, Pat, VarPat, EquationInfixNode, LetExpr, ClassDefNode, InstanceDefNode, SigDeclNode,
  WildcardPat, NumPat, DataPat, FixityDeclNode, DataDefNode, ImportNode, TuplePat, ListPat, CaseBranchNode,
  CaseExpr, LambdaMultiExpr, LambdaCaseExpr, Mod, IdNode, UnitPat, ImportItemNode,
  DataApplyConNode,
  DataInfixConNode,
  DataConNode,
  NodeB,
  VarRefNode,
  BindingHostRole,
  RecordBindingFieldNode,
  RecordExpr,
  RecordDefFieldNode,
  RecordDefNode,
  RecordPunningFieldNode,
  RecordFieldNode,
  RecordPatFieldNode,
  RecordPat,
  RecordUpdateFieldNode,
  RecordUpdateExpr,
} from '@/node/node'
import { Surface0 } from '@/node/stage'
import { assignId, AstId, AstIdState, NodeMap } from '@/node/astId'
import { PassAction } from '@/pipeline'

declare module 'parsecond' {
  export interface ParseErrMap {
    IsReservedWord: {
      word: string
    }
    ConflictDefinition: {
      id: string
    }
    IllegalPat: {}
    NotAConstructor: {
      type: Type
    }
    TooLargeTuple: {
      size: number
    }
    MalformedImport: {}
  }

  export interface ParserState {
    layout: number[]
  }
}

export type P<T> = Parser<T, ParseErr | null>
export type PRes<T> = Result<T, ParseErr | null>

const getCol = (state: ParserState): number => {
  let { index } = state
  while (index >= 0 && state.input[index] !== '\n') index --
  return state.index - index - 1
}

const pWhite: Parser<string, null> = p.join(p.many(
  p.notEmpty(p.join(p.seq([
    p.join(p.many(p.char(' '))),
    p.alt([
      p.join(p.seq([p.str('--'), p.join(p.many(p.noneOf('\n')))])),
      p.pure(''),
    ]),
    p.join(p.many(p.char('\n'))),
  ])))
))

const pLayoutBegin = <T, E>(parser: Parser<T, E>, pSkip = pWhite): Parser<T, E | null> =>
  p.bind(
    pSkip,
    () => state => parser({ ...state, layout: [getCol(state), ...state.layout] }),
  )

const pLayout = <T, E>(parser: Parser<T, E>, pSkip = pWhite): Parser<T, E | null> => p.bindValState(
  pSkip,
  (({ state, val }) => {
    if (val.length && state.rest && getCol(state) <= state.layout[0]) return p.fail(null)
    return parser
  })
)

const pLayoutAligned = <T, E>(parser: Parser<T, E>, pSkip = pWhite): Parser<T, E | null> => p.bindValState(
  pSkip,
  (({ state, val }) => {
    if (val.length && getCol(state) < state.layout[0]) return p.fail(null)
    return parser
  })
)

const pLayoutEnd = <T, E>(parser: Parser<T, E>): Parser<T, E> =>
  p.mapState(parser, state => ({ ...state, layout: state.layout.slice(1) }))

const pBlock = <T, E>(parser: Parser<T, E>, pSkip = pWhite): Parser<T[], E | null> => pLayout(
  p.map(
    p.seq([
      pLayout(pLayoutBegin(parser), pSkip),
      pLayoutEnd(p.many(pLayoutAligned(parser))),
    ]),
    ([head, tail]) => [head, ...tail]
  )
)

const pSpace = pLayout(p.pure(null))
const pSpaced = p.right(pSpace)
const pSpacedAround = p.delimitedBy(pSpace, pSpace)

const pParens = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.parens(pSpacedAround(parser))
const pBrackets = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.brackets(pSpacedAround(parser))
const pBraces = <T, E>(parser: Parser<T, E>): Parser<T, E | null> => p.braces(pSpacedAround(parser))

const pKeyword = <S extends string>(keyword: S): Parser<S, null> => p.notFollowedBy(p.str(keyword), p.regex(/[A-Za-z0-9_]/))

const pMake = <T extends NodeB, E>(parser: Parser<T, E>): Parser<T & NodeHead, E> =>
  oldState => parser(oldState).map(({ val, state }) => ({
    val: {
      ...val,
      astId: 0,
      range: {
        start: oldState.index,
        end: state.index,
      }
    },
    state,
  }))

export const pNumExpr: P<NumExpr> = pMake(p.map(p.decimal, val => ({
  ty: 'num',
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

export const pCharExpr: P<CharExpr> = pMake(p.map(
  p.delimitedBy(p.char('\''), p.char('\''))(pCharInner('\'')),
  val => ({ ty: 'char', val }),
))

export const pStrExpr: P<StrExpr> = pMake(p.map(
  p.delimitedBy(p.char('"'), p.char('"'))(p.join(p.many(pCharInner('"')))),
  val => ({ ty: 'str', val }),
))

export const pWord: P<string> = p.bind(
  p.regex(/[A-Za-z][A-Za-z\d']*|_[A-Za-z\d']+/),
  id => p.result(RESERVED_WORDS.includes(id)
    ? Err(ParseErr('IsReservedWord', { word: id }))
    : Ok(id)
  )
)
export const pWordBig: P<string> = p.guard(pWord, id => isUpper(id[0]))
export const pWordSmall: P<string> = p.guard(pWord, id => isLower(id[0]) || id[0] === '_')
export const pSym: P<string> = p.bind(
  p.join(p.some(p.oneOf(SYM_CHARS))),
  id => p.result(RESERVED_SYMS.includes(id)
    ? Err(ParseErr('IsReservedWord', { word: id }))
    : Ok(id)
  )
)
export const pSymComma: P<string> = p.alt([pSym, p.join(p.some(p.char(',')))])

export const pId = (pStr: P<string>, style: IdNode['style']): P<IdNode> => pMake(
  p.map(pStr, id => ({ ty: 'id', id, style }))
)
export const pIdBig: P<IdNode> = pId(pWordBig, 'big')
export const pIdSmall: P<IdNode> = pId(pWordSmall, 'small')
export const pIdWord: P<IdNode> = p.alt([pIdSmall, pIdBig])
export const pIdSym: P<IdNode> = pId(pSym, 'sym')
export const pIdDataSym: P<IdNode> = pId(p.guard(pSym, id => id.startsWith(':') && id.endsWith(':')), 'sym')
export const pIdSymComma: P<IdNode> = pId(pSymComma, 'sym')
export const pIdSmallOrSymDelimited: P<IdNode> = p.alt([pIdSmall, pParens(p.alt([pIdSym, pIdSmall]))])
export const pIdBigOrDataSymDelimited: P<IdNode> = p.alt([pIdBig, pParens(p.alt([pIdDataSym, pIdBig]))])
export const pIdAllDelimited: P<IdNode> = p.alt([pIdSmallOrSymDelimited, pIdBigOrDataSymDelimited])

export const pVarOf = (pId: P<IdNode>): P<VarExpr> => pMake(
  p.map(pId, id => ({ ty: 'var', id }))
)
export const pVarSymExpr = pVarOf(pIdSym)
export const pVarSymCommaExpr = pVarOf(pIdSymComma)
export const pVarSmallExpr = pVarOf(pIdSmall)
export const pVarBigExpr = pVarOf(pIdBig)
export const pVarWordExpr = p.alt([pVarSmallExpr, pVarBigExpr])

export const pVarPatOf = (pId: P<IdNode>): P<VarPat> => pMake(
  p.map(pId, id => ({ ty: 'varPat', id }))
)
export const pVarSymPat = pVarPatOf(pIdSym)
export const pVarSymCommaPat = pVarPatOf(pIdSymComma)
export const pVarSmallPat = pVarPatOf(pIdSmall)
export const pVarSmallOrSymDelimitedPat = pVarPatOf(pIdSmallOrSymDelimited)

export const pVarRefOf = (pId: P<IdNode>): P<VarRefNode> => pMake(
  p.map(pId, id => ({ ty: 'varRef', id }))
)
export const pVarSmallRef = pVarRefOf(pIdSmall)
export const pVarBigRef = pVarRefOf(pIdBig)
export const pVarSymRef = pVarRefOf(pIdSym)
export const pVarDataSymRef = pVarRefOf(pIdDataSym)
export const pVarSmallOrSymDelimitedRef = p.alt([pVarSmallRef, pParens(p.alt([pVarSymRef, pVarSmallRef]))])
export const pVarBigOrDataSymDelimitedRef = p.alt([pVarBigRef, pParens(p.alt([pVarDataSymRef, pVarBigRef]))])

export const pTupleExprInner: P<TupleExpr<Surface0>> = p.lazy(() => pMake(p.bind(
  p.sep2(pExpr, pSpacedAround(p.char(','))),
  (elems) => p.result(
    elems.length > 4 ? Err(ParseErr('TooLargeTuple', { size: elems.length })) :
    Ok({ ty: 'tuple', elems })
  )
)))

export const pUnitExprInner: P<UnitExpr> = pMake(p.pure({ ty: 'unit' }))

export const pParenExprInner: P<ParenExpr<Surface0>> = p.lazy(() => pMake(p.map(
  pExpr,
  expr => ({ ty: 'paren', expr })
)))

export const pParenExpr: P<Expr<Surface0>> = p.lazy(() => pMake(pParens(
  p.alt([
    pTupleExprInner,
    pSectionLExprInner,
    pSectionRExprInner,
    pVarSymCommaExpr,
    pParenExprInner,
    pUnitExprInner,
  ])
)))

export const pListExpr: P<ListExpr<Surface0>> = p.lazy(() => pMake(p.map(
  pBrackets(p.sep0(pExpr, pSpacedAround(p.char(',')))),
  elems => ({
    ty: 'list',
    elems,
  })
)))

export const pRecordBindingField: P<RecordBindingFieldNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([pIdSmallOrSymDelimited, p.right(pSpacedAround(p.char('=')))(pExpr)]),
  ([key, val]) => ({
    ty: 'recordBindingField',
    key,
    val,
  })
)))

export const pRecordPunningField: P<RecordPunningFieldNode> = p.lazy(() => pMake(p.map(
  pIdSmallOrSymDelimited,
  key => ({
    ty: 'recordPunningField',
    key,
  })
)))

export const pRecordField: P<RecordFieldNode<Surface0>> = p.alt([
  pRecordBindingField, pRecordPunningField,
])

export const pRecordExpr: P<RecordExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pVarBigRef,
    pSpaced(pBraces(p.sep0(pRecordField, pSpacedAround(p.char(','))))),
  ]),
  ([con, fields]) => ({
    ty: 'record',
    con,
    fields,
  })
)))

export const pRecordUpdateField: P<RecordUpdateFieldNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pIdSmallOrSymDelimited,
    p.alt([
      p.map(
        p.seq([
          p.opt(p.right(pSpacedAround(p.char('@')))(pPat)),
          p.right(pSpacedAround(p.str('->')))(pExpr)
        ]),
        ([pat, body]) => pat
          ? {
            ty: 'recordUpdateMatchingField' as const,
            pat,
            body,
          }
          : {
            ty: 'recordUpdatePunningMatchingField' as const,
            body,
          }
      ),
      p.map(
        p.right(pSpacedAround(p.str('|>')))(pExpr),
        func => ({
          ty: 'recordUpdatePipeField' as const,
          func,
        }),
      ),
    ])
  ]),
  ([key, field]) => ({ ...field, key })
)))

export const pRecordUpdateExpr: P<RecordUpdateExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([pVarBigRef, pSpaced(pBraces(p.sep0(pRecordUpdateField, pSpacedAround(p.char(',')))))]),
  ([con, fields]) => ({
    ty: 'recordUpdate',
    con,
    fields,
  })
)))

export const pPrimaryExpr: P<Expr<Surface0>> = p.lazy(() => p.alt([
  pCondExpr,
  pLetExpr,
  pCaseExpr,
  pLambdaCaseExpr,
  pLambdaMultiExpr,

  pParenExpr,
  pListExpr,
  pRecordExpr,
  pRecordUpdateExpr,
  pNumExpr,
  pVarWordExpr,
  pCharExpr,
  pStrExpr,
]))

export const pRollExpr: P<RollExpr<Surface0>> = pMake(p.map(
  p.seq([
    p.opt(pPrimaryExpr),
    p.char('@'),
    pPrimaryExpr,
  ]),
  ([times,, sides]) => ({
    ty: 'roll',
    times,
    sides,
  })
))

export const pRollExprL = p.alt([pRollExpr, pPrimaryExpr])

export const pApplyExpr: P<ApplyMultiExpr<Surface0>> = pMake(p.lazy(() => p.map(
  p.seq([
    p.alt([pVarWordExpr, pParenExpr]),
    p.some(pSpaced(pRollExprL))
  ]),
  ([func, args]) => ({
    ty: 'applyMulti',
    func,
    args,
  })
)))
export const pApplyExprL = p.lazy(() => p.alt([pApplyExpr, pRollExprL]))

export const pInfixExpr: P<InfixExpr<Surface0>> = pMake(p.map(
  p.seq([
    pApplyExprL,
    p.some(p.seq([pSpacedAround(pVarSymExpr), pApplyExprL])),
  ]),
  ([head, tail]) => pipe(
    tail.reduce<{
      ops: VarExpr[],
      args: Expr<Surface0>[]
    }>(
      ({ ops, args }, [op, arg]) => ({
        ops: [...ops, op],
        args: [...args, arg],
      }),
      { ops: [], args: [head] }
    ),
    ({ ops, args }) => ({
      ty: 'infix',
      ops,
      args,
    })
  )
))
export const pInfixExprL = p.lazy(() => p.alt([pInfixExpr, pApplyExprL]))

export const pSectionLExprInner: P<SectionLExpr<Surface0>> = pMake(p.map(
  p.seq([pInfixExprL, pSpaced(pVarSymCommaExpr)]),
  ([arg, op]) => ({
    ty: 'sectionL',
    op,
    arg,
  })
))

export const pSectionRExprInner: P<SectionRExpr<Surface0>> = pMake(p.map(
  p.seq([pVarSymCommaExpr, pSpaced(pInfixExprL)]),
  ([op, arg]) => ({
    ty: 'sectionR',
    op,
    arg,
  })
))

export const pCondExpr: P<CondExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('if'),
    pSpaced(pExpr),
    pSpaced(pKeyword('then')),
    pSpaced(pExpr),
    pSpaced(pKeyword('else')),
    pSpaced(pExpr),
  ]),
  ([, cond,, yes,, no]) => ({
    ty: 'cond',
    cond,
    yes,
    no,
  }),
)))

export const pBinding: P<BindingNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([pPat, pSpacedAround(p.char('=')), pExpr]),
  ([pat,, body]) => ({
    ty: 'binding',
    pat,
    body,
  })
)))

export const pEquationApplyHead: P<EquationApplyHeadNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    p.alt([pVarSmallOrSymDelimitedRef, pParens(pEquationHead)]),
    p.some(pSpaced(pPrimaryPat)),
  ]),
  ([func, params]) => ({
    ty: 'equationApplyHead',
    func,
    params,
  })
)))

export const pEquationInfixHead: P<EquationInfixNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pPat, pSpacedAround(pVarSymRef), pPat,
  ]),
  ([lhs, op, rhs]) => ({
    ty: 'equationInfixHead',
    lhs,
    op,
    rhs,
  })
)))

export const pEquationHead: P<EquationHeadNode<Surface0>> = p.alt([pEquationApplyHead, pEquationInfixHead])

export const pEquation: P<EquationNode<Surface0>> = pMake(p.lazy(() => p.map(
  p.seq([
    pEquationHead,
    pSpacedAround(p.char('=')),
    pExpr,
  ]),
  ([head,, body]) => ({
    ty: 'equation',
    head,
    body,
  })
)))

export const pBindingHost = (role: BindingHostRole): P<BindingHostNode<Surface0>> => p.lazy(() => pMake(p.map(
  pBlock(p.alt([pSigDecl, pFixityDecl, pBinding, pEquation])),
  defs => pipe(
    defs,
    R.groupByProp('ty'),
    ({
      sigDecl: sigDecls = [],
      fixityDecl: fixityDecls = [],
      equation: equations = [],
      binding: bindings = [],
    }) => ({
      ty: 'bindingHost',
      role,
      sigDecls,
      fixityDecls,
      bindings: [...equations, ...bindings],
    })
  )
)))

export const pClassDef: P<ClassDefNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('class'),
    pSpaced(pIdBig),
    pSpaced(pTypeNode(pVarType)),
    pSpaced(pKeyword('where')),
    pBindingHost('class'),
  ]),
  ([, id, param,, bindingHost]) => ({
    ty: 'classDef',
    id,
    param,
    bindingHost,
  })
)))

export const pInstanceDef: P<InstanceDefNode<Surface0>> = pMake(p.lazy(() => p.map(
  p.seq([
    pKeyword('instance'),
    pSpaced(pIdBig),
    pSpaced(pTypeNode(pType)),
    pSpaced(pKeyword('where')),
    pBindingHost('instance'),
  ]),
  ([, classId, arg,, bindingHost]) => ({
    ty: 'instanceDef',
    classId,
    arg,
    bindingHost,
  })
)))

export const pLetExpr: P<LetExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('let'),
    pBindingHost('normal'),
    pSpacedAround(pKeyword('in')),
    pExpr,
  ]),
  ([, bindingHost,, body]) => ({
    ty: 'let',
    bindingHost,
    body,
  })
)))

export const pWildcardPat: P<WildcardPat> = pMake(p.map(p.char('_'), () => ({
  ty: 'wildcardPat',
})))

export const pNumPat: P<NumPat> = pMake(p.map(pNumExpr, ({ val }) => ({
  ty: 'numPat',
  val,
})))

export const pUnitPat: P<UnitPat> = pMake(p.map(
  pParens(p.pure(null)),
  () => ({ ty: 'unitPat' })
))

export const pConPat: P<DataPat<Surface0>> = p.lazy(() => pMake(p.map(
  pVarBigRef,
  con => ({
    ty: 'dataPat',
    con,
    args: [],
  })
)))

export const pListPat: P<ListPat<Surface0>> = p.lazy(() => pMake(p.map(
  pBrackets(p.sep0(pPat, pSpacedAround(p.char(',')))),
  elems => ({
    ty: 'listPat',
    elems,
  })
)))

export const pTuplePatInner: P<TuplePat<Surface0>> = p.lazy(() => pMake(p.bind(
  p.sep2(p.alt([pInfixPat, pPrimaryPat]), pSpacedAround(p.char(','))),
  elems => p.result(elems.length > 4
    ? Err(ParseErr('TooLargeTuple', { size: elems.length }))
    : Ok({ ty: 'tuplePat', elems })
  )
)))

export const pParenPat: P<Pat<Surface0>> = p.lazy(() => p.parens(pSpacedAround(p.alt([
  pTuplePatInner,
  pVarSymPat,
  pPat,
]))))

export const pRecordPatField: P<RecordPatFieldNode<Surface0>> =p.lazy(() => pMake(p.map(
  p.seq([pIdSmallOrSymDelimited, p.opt(p.right(pSpacedAround(p.char('@')))(pPat))]),
  ([key, pat]) => pat
    ? {
      ty: 'recordPatRebindingField',
      key,
      pat,
    }
    : {
      ty: 'recordPatPunningField',
      key,
    }
)))


export const pRecordPat: P<RecordPat<Surface0>> = pMake(p.map(
  p.seq([
    pVarBigRef,
    pSpaced(pBraces(p.sep0(pRecordPatField, pSpacedAround(p.char(','))))),
  ]),
  ([con, fields]) => ({
    ty: 'recordPat',
    con,
    fields,
  })
))

export const pVarPat: P<VarPat> = pMake(p.map(pIdSmall, id => ({
  ty: 'varPat',
  id,
})))

export const pPrimaryPat: P<Pat<Surface0>> = p.alt([
  pParenPat,
  pListPat,
  pVarPat,
  pWildcardPat,
  pRecordPat,
  pConPat,
  pNumPat,
  pUnitPat,
])

export const pApplyPat: P<DataPat<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([pVarBigOrDataSymDelimitedRef, p.some(pSpaced(pPat))]),
  ([con, args]) => ({
    ty: 'dataPat',
    con,
    args,
  }))
))
export const pApplyPatL = p.alt([pApplyPat, pPrimaryPat])

export const pInfixPat: P<Pat<Surface0>> = pMake(p.map(
  p.seq([
    pApplyPatL,
    p.many(p.seq([pSpacedAround(pVarDataSymRef), pApplyPatL])),
  ]),
  ([head, tail]) => {
    if (! tail.length) return head
    const { ops, args } = tail.reduce(
      ({ ops, args }, [op, arg]) => ({
        ops: [...ops, op],
        args: [...args, arg],
      }),
      { ops: Array.of<VarRefNode>(), args: [head] }
    )
    return ({
      ty: 'infixPat',
      ops,
      args,
    })
  }
))

export const pPat: P<Pat<Surface0>> = pInfixPat

export const pCaseBranch: P<CaseBranchNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pPat,
    pSpacedAround(p.str('->')),
    pExpr,
  ]),
  ([pat,, body]) => ({
    ty: 'caseBranch',
    pat,
    body,
  })
)))

export const pCaseExpr: P<CaseExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('case'),
    pSpaced(pExpr),
    pSpacedAround(p.str('of')),
    pBlock(pCaseBranch),
  ]),
  ([, scrutinee,, branches]) => ({
    ty: 'case',
    scrutinee,
    branches,
  }))
))

export const pLambdaMultiExpr: P<LambdaMultiExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    p.char('\\'),
    p.some(pSpaced(pPrimaryPat)),
    pSpacedAround(p.str('->')),
    pExpr,
  ]),
  ([, params,, body]) => ({
    ty: 'lambdaMulti',
    params,
    body,
  })
)))

export const pLambdaCaseExpr: P<LambdaCaseExpr<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    p.char('\\'),
    pSpaced(pKeyword('case')),
    pBlock(pCaseBranch),
  ]),
  ([,, branches]) => ({
    ty: 'lambdaCase',
    branches,
  })
)))

export const pConType: P<ConType> = p.map(
  pIdBigOrDataSymDelimited,
  ({ id }) => ConType(id),
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

export const pApplyType: P<ApplyType> = p.lazy(() => p.map(
  p.seq([
    p.alt([pConType, pVarType]),
    p.some(pSpaced(pPrimaryType)),
  ]),
  ([func, args]) => ApplyTypeMulti(func, ...args)
))

export const pFuncType: P<FuncType> = p.lazy(() => p.map(
  p.seq([p.alt([pApplyType, pPrimaryType]), pSpacedAround(p.str('->')), pType]),
  ([param,, ret]) => FuncType(param, ret)
))

export const pVarType: P<VarType> = p.map(
  pWordSmall,
  VarType,
)

export const pType: P<Type> = p.alt([
  pFuncType,
  pApplyType,
  pPrimaryType,
])

export const pTypeNode = <T extends Type>(pSomeType: P<T>): P<TypeNode<T>> =>
  pMake(p.map(pSomeType, type => ({
    ty: 'type',
    type,
  })))

export const pConConstr: P<string> = pWordBig

export const pConstr: P<Constr> = p.map(
  p.seq([pConConstr, pSpaced(p.map(pType, Type.rigidify))]),
  ([classId, arg]) => ({ classId, arg })
)

export const pConstrs: P<Constrs> = p.alt([
  p.map(pConstr, Array.of),
  pParens(p.sep0(pConstr, pSpacedAround(p.char(',')))),
])

export const pConstrContext: P<Constrs> = p.left(pSpacedAround(p.str('=>')))(pConstrs)

export const pConstrContextOpt: P<Constrs> = p.alt([
  pConstrContext,
  p.map(p.pure(null), () => []),
])

export const pTypeSchemeNode = (pSomeType: P<Type>): P<TypeSchemeNode> => pMake(p.map(
  p.seq([pConstrContextOpt, pSomeType]),
  ([constrs, type]) => ({
    ty: 'typeScheme' as const,
    isImplicit: true,
    typeScheme: pipe(
      type,
      Type.rigidify,
      Type.generalize,
      TypeScheme.unionConstrs(constrs),
    ),
  })
))

export const pTermExpr: P<Expr<Surface0>> = pMake(p.alt([
  pInfixExprL,
]))

export const pAnnExpr: P<AnnExpr<Surface0>> = pMake(p.map(
  p.seq([pTermExpr, pSpacedAround(p.str('::')), pTypeSchemeNode(pType)]),
  ([expr,, ann]) => ({
    ty: 'ann',
    expr,
    ann,
  })
))

export const pExpr: P<Expr<Surface0>> = p.alt([
  pAnnExpr,
  pTermExpr,
])

export const pSigDecl: P<SigDeclNode> = pMake(p.map(
  p.seq([
    p.sep1(pIdSmallOrSymDelimited, pSpacedAround(p.char(','))),
    pSpacedAround(p.str('::')),
    pTypeSchemeNode(pType),
  ]),
  ([ids,, sig]) => ({
    ty: 'sigDecl',
    ids,
    sig,
  })
))

export const pFixityDecl: P<FixityDeclNode> = pMake(p.map(
  p.seq([
    p.str('infix'),
    p.opt(p.oneOf('lr')),
    pSpaced(p.posint),
    pSpaced(p.sep1(pIdSym, pSpacedAround(p.char(',')))),
  ]),
  ([, assocChar, prec, ids]) => ({
    ty: 'fixityDecl',
    ids,
    fixity: {
      assoc: assocChar === 'l' ? 'left' : assocChar === 'r' ? 'right' : 'none',
      prec,
    },
  })
))

export const pDataApplyCon: P<DataApplyConNode> = pMake(p.map(
  p.seq([
    pIdBigOrDataSymDelimited,
    p.many(pSpaced(pTypeNode(pType))),
  ]),
  ([func, params]) => ({
    ty: 'dataApplyCon',
    func,
    params,
  })
))

export const pDataInfixCon: P<DataInfixConNode> = pMake(p.map(
  p.seq([
    pTypeNode(pType),
    pSpacedAround(pIdDataSym),
    pTypeNode(pType),
  ]),
  ([lhs, op, rhs]) => ({
    ty: 'dataInfixCon',
    lhs,
    op,
    rhs,
  })
))

export const pDataCon: P<DataConNode<Surface0>> = p.alt([
  pDataApplyCon,
  pDataInfixCon,
])

export const pDataDef: P<DataDefNode<Surface0>> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('data'),
    pSpaced(pIdBig),
    p.many(pSpaced(pTypeNode(pVarType))),
    pSpacedAround(p.char('=')),
    p.opt(pSpacedAround(p.char('|'))),
    p.sep1(
      pDataCon,
      pSpacedAround(p.char('|'))
    ),
  ]),
  ([, id, params,,, cons]) => ({
    ty: 'dataDef',
    id,
    params,
    cons,
  }))
))

export const pRecordDefField: P<RecordDefFieldNode> = p.lazy(() => pMake(p.map(
  p.seq([pIdSmallOrSymDelimited, pSpacedAround(p.str('::')), pTypeNode(pType)]),
  ([key,, type]) => ({
    ty: 'recordDefField',
    key,
    type,
  }
))))

export const pRecordDef: P<RecordDefNode> = p.lazy(() => pMake(p.map(
  p.seq([
    pKeyword('record'),
    pSpaced(pIdBig),
    p.many(pSpaced(pTypeNode(pVarType))),
    pSpacedAround(p.char('=')),
    pBraces(p.sep0(pRecordDefField, pSpacedAround(p.char(',')))),
  ]),
  ([, id, params,, fields]) => ({
    ty: 'recordDef',
    id,
    params,
    fields
  })
)))

export const pImportItem: P<ImportItemNode> = pMake(p.map(
  p.seq([
    pIdAllDelimited,
    p.opt(p.right(pSpacedAround(p.str('as')))(pIdAllDelimited)),
  ]),
  ([id, qid]) => ({
    ty: 'importItem',
    id,
    qid,
  })
))

export const pImport: P<ImportNode> = pMake(p.bind(
  p.seq([
    pKeyword('import'),
    pSpaced(pIdBig),
    p.opt(pSpaced(pKeyword('open'))),
    p.opt(pSpaced(pBraces(
      p.sep0(pImportItem, pSpacedAround(p.char(',')))
    ))),
    p.opt(p.right(pSpacedAround(pKeyword('as')))(pIdBig))
  ]),
  ([, modId, open, items, qid]) => p.result(
    open === null || qid === null
      ? Ok({
        ty: 'import',
        modId,
        items,
        isOpen: open !== null,
        qid,
      })
      : Err(ParseErr('MalformedImport', {}))
  )
))

export const pMod: P<Mod<Surface0>> = p.map(
  p.ranged(pBlock(p.alt([
    pImport,
    pDataDef,
    pRecordDef,
    pClassDef,
    pInstanceDef,

    pSigDecl,
    pFixityDecl,
    pBinding,
    pEquation,
  ]))),
  ({ val: defs, range }) => pipe(
    defs,
    R.groupByProp('ty'),
    ({
      import: imports = [],
      dataDef: dataDefs = [],
      recordDef: recordDefs = [],
      classDef: classDefs = [],
      instanceDef: instanceDefs = [],
      sigDecl: sigDecls = [],
      fixityDecl: fixityDecls = [],
      equation: equations = [],
      binding: bindings = [],
    }) => ({
      ty: 'mod',
      imports,
      dataDefs,
      recordDefs,
      classDefs,
      instanceDefs,
      bindingHost: {
        ty: 'bindingHost',
        role: 'normal',
        sigDecls,
        fixityDecls,
        bindings: [...equations, ...bindings],
        astId: 0,
        range,
      },
      astId: 0,
      range,
    })
  )
)

export type LayoutParser<T> = (input: string) => PRes<T>
export const getLayoutParser = <T>(parser: P<T>): LayoutParser<T> =>
  input => p.ended(pSpacedAround(parser))({
    input,
    index: 0,
    rest: input,
    layout: [-1],
  }).map(({ val }) => val)

export const pModS: LayoutParser<ParseMod.Ok> = getLayoutParser(p.map(
  pMod,
  mod => pipe(
    mod,
    assignId,
    ({ node, ais, nodeMap }) => ({ mod: node, ais, nodeMap }),
  )
))

export const parseMod: PassAction<'parse'> = (modId, store) => {
  const { source } = store.get(modId)
  return pModS(source)
}

export namespace ParseMod {
  export type Ok = {
    mod: Mod<Surface0>
    ais: AstIdState
    nodeMap: NodeMap
  }

  export type Err = ParseErr | null

  export type Res = Result<Ok, Err>
}
