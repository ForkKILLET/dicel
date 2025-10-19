import { Range } from 'parsecond'
import { match } from 'ts-pattern'
import { describeToShow, Dict, indent, unsnoc } from './utils'
import { Type, TypeScheme, VarType } from './type'
import { Data } from './data'
import { isSymbolOrComma, showStr } from './lex'
import { Fixity } from './lex'
import { pipe, values } from 'remeda'
import { BindingGroup } from './infer'

export type DRange = { range: Range }
export type DId = { astId: number }

export type NumExpr<D = {}> = D & {
  type: 'num'
  val: number
}

export type UnitExpr<D = {}> = D & {
  type: 'unit'
}

export type CharExpr<D = {}> = D & {
  type: 'char'
  val: string
}

export type StrExpr<D = {}> = D & {
  type: 'str'
  val: string
}

export type TupleExprAuto<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'tuple'
  elems: ExprS<D, S>[]
}

export type ListExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'list'
  elems: ExprS<D, S>[]
}

export type VarExpr<D = {}> = D & {
  type: 'var'
  id: string
  isInfix?: boolean
}

export type ApplyExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'apply'
  func: ExprS<D, S>
  arg: ExprS<D, S>
}

export const ApplyExprMulti = (func: ExprDes, args: ExprDes[]): ApplyExpr<{}, 'des'> => (args.length
  ? pipe(
    unsnoc(args),
    ([args, arg]) => ({
      type: 'apply',
      func: ApplyExprMulti(func, args),
      arg,
    })
  )
  : func
) as ApplyExpr<{}, 'des'>

export const TupleExprAuto = (args: ExprDes[]): ExprDes => {
  const { length } = args
  if (length === 0) return { type: 'unit' }
  if (length === 1) return args[0]
  return ApplyExprMulti(
    { type: 'var', id: ','.repeat(length - 1) },
    args,
  )
}

export type ApplyMultiExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'applyMulti'
  func: ExprS<D, S>
  args: ExprS<D, S>[]
}

export type InfixExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'infix'
  ops: VarExpr<D>[]
  args: ExprS<D, S>[]
}

export type SectionLExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'sectionL'
  op: VarExpr<D>
  arg: ExprS<D, S>
}

export type SectionRExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'sectionR'
  arg: ExprS<D, S>
  op: VarExpr<D>
}

export type RollExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'roll'
  times: ExprS<D, S> | null
  sides: ExprS<D, S>
}

export type CondExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'cond'
  cond: ExprS<D, S>
  yes: ExprS<D, S>
  no: ExprS<D, S>
}

export type Binding<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'binding'
  lhs: PatternS<D, S>
  rhs: ExprS<D, S>
}

export type BindingRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'bindingRes'
  lhs: PatternS<D, S>
  rhs: ExprS<D, S>
  idSet: Set<string>
}

export type Equation<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'equation'
  var: VarExpr<D>
  params: PatternS<D, S>[]
  rhs: ExprS<D, S>
}

export type EquationRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'equationRes'
  var: VarExpr<D>
  params: PatternS<D, S>[]
  rhs: ExprS<D, S>
  idSet: Set<string>
}

export type LetExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'let'
  bindingHost: BindingHost<D, S>
  body: ExprS<D, S>
}

export type LetResExpr<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'letRes'
  bindingHost: BindingHostRes<D, S>
  body: ExprS<D, S>
}

export type LetDesExpr<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'letDes'
  bindingHost: BindingHostDes<D, S>
  body: ExprS<D, S>
}

export type ParenExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'paren'
  expr: ExprS<D, S>
}

export type WildcardPattern<D = {}> = D & {
  type: 'pattern'
  sub: 'wildcard'
}

export type NumPattern<D = {}> = D & {
  type: 'pattern'
  sub: 'num'
  val: number
}

export type UnitPattern<D = {}> = D & {
  type: 'pattern'
  sub: 'unit'
}

export type ConPattern<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'pattern'
  sub: 'con'
  con: VarExpr<D>
  args: PatternS<D, S>[]
}

export type ListPattern<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'pattern'
  sub: 'list'
  elems: PatternS<D, S>[]
}

export type TuplePattern<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'pattern'
  sub: 'tuple'
  elems: PatternS<D, S>[]
}

export const TuplePatternAuto = (args: PatternDes[]): PatternDes => {
  const { length } = args
  if (length === 0) return { type: 'pattern', sub: 'unit' }
  if (length === 1) return args[0]
  return {
    type: 'pattern',
    sub: 'con',
    con: { type: 'var', id: ','.repeat(length - 1) },
    args,
  }
}

export type VarPattern<D = {}> = D & {
  type: 'pattern'
  sub: 'var'
  var: VarExpr<D>
}

export type CaseBranch<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'caseBranch'
  pattern: PatternS<D, S>
  body: ExprS<D, S>
}

export type CaseBranchRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'caseBranchRes'
  idSet: Set<string>
  pattern: PatternS<D, S>
  body: ExprS<D, S>
}

export type CaseExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'case'
  subject: ExprS<D, S>
  branches: CaseBranch<D, S>[]
}

export type CaseResExpr<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'caseRes'
  subject: ExprS<D, S>
  branches: CaseBranchRes<D, S>[]
}

export type LambdaMultiExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'lambdaMulti'
  params: PatternS<D, S>[]
  body: ExprS<D, S>
}

export type LambdaMultiResExpr<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'lambdaMultiRes'
  params: PatternS<D, S>[]
  idSets: Set<string>[]
  body: ExprS<D, S>
}

export type LambdaResExpr<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'lambdaRes'
  param: PatternS<D, S>
  body: ExprS<D, S>
  idSet: Set<string>
}

export const LambdaExprMulti = (
  [param, ...params]: PatternS<{}, 'des'>[],
  [idSet, ...idSets]: Set<string>[],
  body: ExprDes,
): LambdaResExpr<{}, 'des'> => ({
  type: 'lambdaRes',
  param,
  body: ! params.length
    ? body
    : LambdaExprMulti(params, idSets, body),
  idSet,
})

export type LambdaCaseExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'lambdaCase'
  branches: CaseBranch<D, S>[]
}

export type LambdaCaseResExpr<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'lambdaCaseRes'
  branches: CaseBranchRes<D, S>[]
}

export type TypeNode<D = {}> = D & {
  type: 'typeNode'
  typeScheme: TypeScheme
}

export type AnnExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'ann'
  expr: ExprS<D, S>
  ann: TypeNode<D>
}

export type BindingDef<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'bindingDef'
  binding: Binding<D, S>
}

export type BindingDefRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'bindingDefRes'
  binding: BindingRes<D, S>
}

export type EquationDef<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'equationDef'
  equation: Equation<D, S>
}

export type EquationDefRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'equationDefRes'
  equation: EquationRes<D, S>
}

export type EquationDefGroupRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'equationDefGroupRes'
  id: string
  arity: number
  equationDefs: EquationDefRes<D, S>[]
}

export type Decl<D = {}> = D & {
  type: 'decl'
  vars: VarExpr<D>[]
  ann: TypeNode<D>
}

export type FixityDecl<D = {}> = D & {
  type: 'fixityDecl'
  vars: VarExpr<D>[]
  prec: number
  assoc: 'left' | 'right' | 'none'
}

export type DataDecl<D = {}> = D & {
  type: 'dataDecl'
  id: string
  data: Data
}

export type ImportDecl<D = {}> = D & {
  type: 'import'
  modId: string
  ids: string[] | null
}

export type Import = {
  idSet: Set<string> | null
}

export type BindingHost<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'bindingHost'
  abstract: boolean

  decls: Decl<D>[]
  fixityDecls: FixityDecl<D>[]

  bindingDefs: BindingDef<D, S>[]
  equationDefs: EquationDef<D, S>[]
}

export type BindingHostRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'bindingHostRes'
  abstract: boolean

  declDict: Dict<Decl>
  fixityDict: Dict<FixityDecl>

  bindingDefs: BindingDefRes<D, S>[]
  bindingDefIdSet: Set<string>

  equationDefGroupDict: Dict<EquationDefGroupRes<D, S>>
  equationDefIdSet: Set<string>

  idSet: Set<string>
  bindingGroups: BindingGroup.Group[]
}

export type BindingHostDes<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'bindingHostDes'
  abstract: boolean

  declDict: Dict<Decl>
  fixityDict: Dict<FixityDecl>

  bindings: BindingRes<D, S>[]
  idSet: Set<string>
  bindingGroups: BindingGroup.Group[]
}

export type Mod<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'mod'

  imports: ImportDecl<D>[]
  dataDecls: DataDecl<D>[]
  classDefs: ClassDef<D, S>[]
  instanceDefs: InstanceDef<D, S>[]

  bindingHost: BindingHost<D, S>
}

export type ModRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'modRes'

  imports: ImportDecl<D>[]
  dataDecls: DataDecl<D>[]
  dataDict: Dict<Data>
  classDefDict: Dict<ClassDefRes<D, S>>
  instanceDefs: InstanceDefRes<D, S>[]

  importDict: Dict<Import>
  importModIdSet: Set<string>
  dataConIdSet: Set<string>

  bindingHost: BindingHostRes<D, S>

  idSet: Set<string>
}

export type ModDes<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'modDes'

  imports: ImportDecl<D>[]
  dataDecls: DataDecl<D>[]
  dataDict: Dict<Data>
  classDefDict: Dict<ClassDefDes<D, S>>
  instanceDefs: InstanceDefDes<D, S>[]

  importDict: Dict<Import>
  importModIdSet: Set<string>
  dataConIdSet: Set<string>

  bindingHost: BindingHostDes<D, S>

  idSet: Set<string>
}

export type ClassDef<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'classDef'
  id: string
  param: VarType
  bindingHost: BindingHost<D, S>
}

export type ClassDefRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'classDefRes'
  id: string
  param: VarType
  bindingHost: BindingHostRes<D, S>
}

export type ClassDefDes<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'classDefDes'
  id: string
  param: VarType
  bindingHost: BindingHostDes<D, S>
}

export type InstanceDef<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'instanceDef'
  classId: string
  arg: Type
  bindingHost: BindingHost<D, S>
}

export type InstanceDefRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'instanceDefRes'
  classId: string
  arg: Type
  bindingHost: BindingHostRes<D, S>
}

export type InstanceDefDes<D = {}, S extends NodeStage = 'des'> = D & {
  type: 'instanceDefDes'
  classId: string
  arg: Type
  bindingHost: BindingHostDes<D, S>
}

export type ExprRawToRaw<D = {}, S extends NodeStage = 'raw'> =
  | CaseExpr<D, S>
  | LetExpr<D, S>
  | LambdaMultiExpr<D, S>
  | LambdaCaseExpr<D, S>

export type ExprRawToRes<D = {}, S extends NodeStage = 'raw'> =
  | RollExpr<D, S>
  | InfixExpr<D, S>
  | ApplyMultiExpr<D, S>
  | SectionLExpr<D, S>
  | SectionRExpr<D, S>
  | ListExpr<D, S>
  | TupleExprAuto<D, S>
  | ParenExpr<D, S>

export type ExprRawToDes<D = {}, S extends NodeStage = 'raw'> =
  | NumExpr<D>
  | UnitExpr<D>
  | CharExpr<D>
  | StrExpr<D>
  | VarExpr<D>
  | AnnExpr<D, S>
  | CondExpr<D, S>

export type ExprRaw<D = {}> =
  | ExprRawToRaw<D, 'raw'>
  | ExprRawToRes<D, 'raw'>
  | ExprRawToDes<D, 'raw'>

export type ExprResToRes<D = {}, S extends NodeStage = 'res'> =
  | LetResExpr<D, S>
  | LambdaCaseResExpr<D, S>
  | LambdaMultiResExpr<D, S>

export type ExprResToDes<D = {}, S extends NodeStage = 'res'> =
  | CaseResExpr<D, S>

export type ExprRes<D = {}> =
  | ExprRawToRes<D, 'res'>
  | ExprRawToDes<D, 'res'>
  | ExprResToRes<D, 'res'>
  | ExprResToDes<D, 'res'>

export type ExprDesToDes<D = {}, S extends NodeStage = 'des'> =
  | LetDesExpr<D, S>
  | LambdaResExpr<D, S>
  | ApplyExpr<D, S>

export type ExprDes<D = {}> =
  | ExprRawToDes<D, 'des'>
  | ExprResToDes<D, 'des'>
  | ExprDesToDes<D, 'des'>

export type Expr<D = {}> =
  | ExprRaw<D>
  | ExprRes<D>
  | ExprDes<D>

export type ExprS<D, S extends NodeStage> = {
  raw: ExprRaw<D>
  res: ExprRes<D>
  des: ExprDes<D>
}[S]

export type PatternRawToRaw<_D = {}, _S extends NodeStage = 'raw'> =
  | never

export type PatternRawToRes<D = {}, S extends NodeStage = 'raw'> =
  | ListPattern<D, S>
  | TuplePattern<D, S>

export type PatternRawToDes<D = {}, S extends NodeStage = 'raw'> =
  | WildcardPattern<D>
  | NumPattern<D>
  | UnitPattern<D>
  | ConPattern<D, S>
  | VarPattern<D>

export type PatternRaw<D = {}> =
  | PatternRawToRaw<D, 'raw'>
  | PatternRawToRes<D, 'raw'>
  | PatternRawToDes<D, 'raw'>

export type PatternResToRes<_D = {}, _S extends NodeStage = 'res'> =
  | never

export type PatternResToDes<_D = {}, _S extends NodeStage = 'res'> =
  | never

export type PatternRes<D = {}> =
  | PatternRawToRes<D, 'res'>
  | PatternRawToDes<D, 'res'>
  | PatternResToRes<D, 'res'>
  | PatternResToDes<D, 'res'>

export type PatternDesToDes<_D = {}, _S extends NodeStage = 'des'> =
  | never

export type PatternDes<D = {}> =
  | PatternRawToDes<D, 'des'>
  | PatternResToDes<D, 'des'>
  | PatternDesToDes<D, 'des'>

export type Pattern<D = {}, S extends NodeStage = NodeStage> =
  | PatternRaw<D>
  | PatternRes<D>
  | PatternDes<D>

export type PatternS<D, S extends NodeStage> = {
  raw: PatternRaw<D>
  res: PatternRes<D>
  des: PatternDes<D>
}[S]

export type NodeRawToRaw<D = {}, S extends NodeStage = 'raw'> =
  | ExprRawToRaw<D, S>
  | PatternRawToRaw<D, S>
  | Mod<D, S>
  | BindingHost<D, S>
  | BindingDef<D, S>
  | EquationDef<D, S>
  | Decl<D>
  | DataDecl<D>
  | ImportDecl<D>
  | FixityDecl<D>
  | CaseBranch<D, S>
  | Binding<D, S>
  | Equation<D, S>
  | ClassDef<D, S>
  | InstanceDef<D, S>

export type NodeRawToRes<D = {}, S extends NodeStage = 'raw'> =
  | ExprRawToRes<D, S>
  | PatternRawToRes<D, S>

export type NodeRawToDes<D = {}, S extends NodeStage = 'raw'> =
  | ExprRawToDes<D, S>
  | PatternRawToDes<D, S>
  | TypeNode<D>

export type NodeRaw<D = {}> =
  | NodeRawToRaw<D, 'raw'>
  | NodeRawToRes<D, 'raw'>
  | NodeRawToDes<D, 'raw'>

export type NodeResToRes<D = {}, S extends NodeStage = 'res'> =
  | ExprResToRes<D, S>
  | PatternResToRes<D, S>
  | ModRes<D, S>
  | ClassDefRes<D, S>
  | InstanceDefRes<D, S>
  | BindingHostRes<D, S>
  | EquationRes<D, S>
  | EquationDefRes<D, S>
  | EquationDefGroupRes<D, S>

export type NodeResToDes<D = {}, S extends NodeStage = 'res'> =
  | ExprResToDes<D, S>
  | PatternResToDes<D, S>
  | CaseBranchRes<D, S>
  | BindingDefRes<D, S>
  | BindingRes<D, S>

export type NodeRes<D = {}> =
  | NodeRawToRes<D, 'res'>
  | NodeRawToDes<D, 'res'>
  | NodeResToRes<D, 'res'>
  | NodeResToDes<D, 'res'>

export type NodeDesToDes<D = {}, S extends NodeStage = 'des'> =
  | ExprDesToDes<D, S>
  | PatternDesToDes<D, S>
  | ModDes<D, S>
  | ClassDefDes<D, S>
  | InstanceDefDes<D, S>
  | BindingHostDes<D, S>

export type NodeDes<D = {}> =
  | NodeRawToDes<D, 'des'>
  | NodeResToDes<D, 'des'>
  | NodeDesToDes<D, 'des'>

export type Node<D = {}, S extends NodeStage = NodeStage> =
  | NodeRaw<D>
  | NodeRes<D>
  | NodeDes<D>

export type NodeS<D, S extends NodeStage> = {
  raw: NodeRaw<D>
  res: NodeRes<D>
  des: NodeDes<D>
}[S]

export type NodeStage = 'raw' | 'res' | 'des'

export type ExprType = Expr['type']
export type ExprRawType = ExprRaw['type']
export type ExprResType = ExprRes['type']
export type ExprDesType = ExprDes['type']

export type NodeType = Node['type']
export type NodeRawType = NodeRaw['type']
export type NodeResType = NodeRes['type']
export type NodeDesType = NodeDes['type']

export type PatternSub = Pattern['sub']

export namespace Pattern {
  export const needsParen = (self: Pattern, parent: Pattern | null): boolean => (
    self.sub === 'con' && self.args.length > 0
  )

  export const show = describeToShow<Pattern, Pattern>(
    pattern => pattern,
    (pattern: Pattern, show): string => match(pattern)
      .with({ sub: 'wildcard' }, () => '_')
      .with({ sub: 'num' }, ({ val }) => String(val))
      .with({ sub: 'unit' }, () => '')
      .with({ sub: 'var' }, ({ var: { id } }) => id)
      .with({ sub: 'con' }, ({ con: { id }, args }) => `${id} ${args.map(show).join(' ')}`)
      .with({ sub: 'tuple' }, ({ elems }) => `(${elems.map(show).join(', ')})`)
      .with({ sub: 'list' }, ({ elems }) => `[${elems.map(show).join(', ')}]`)
      .exhaustive(),
    needsParen,
  )
}

export namespace Node {
  export const is = <const Ts extends NodeType[]>(node: Node, types: Ts): node is Node & { type: Ts[number] } => types.includes(node.type)

  export const needsParen = (self: Node, parent: Node | null): boolean => (
    self.type === 'var' && (
      isSymbolOrComma(self.id) && (! parent || ! Array.of<NodeType>('infix', 'sectionL', 'sectionR').includes(parent?.type))
    ) ||
    self.type === 'sectionL' || self.type === 'sectionR' ||
    parent?.type === 'apply' && (
      self.type === 'lambdaRes' ||
      self.type === 'apply' && self === parent.arg
    )
  )

  export const show = describeToShow<Node, Node>(
    expr => expr,
    (node, show): string => {
      switch (node.type) {
        case 'num':
          return String(node.val)
        case 'unit':
          return ''
        case 'char':
          return showStr(node.val, '\'')
        case 'str':
          return showStr(node.val, '"')
        case 'var':
          return node.id
        case 'cond':
          return `${show(node.cond)} ? ${show(node.yes)} : ${show(node.no)}`
        case 'let':
        case 'letRes':
        case 'letDes':
          return `let ${show(node.bindingHost)} in ${show(node.body)}`
        case 'case':
        case 'caseRes':
          return `case ${show(node.subject)} of ${node.branches.map(show).join('; ')}`
        case 'caseBranch':
        case 'caseBranchRes':
          return `${show(node.pattern)} -> ${show(node.body)}`
        case 'pattern':
          return Pattern.show(node)
        case 'binding':
        case 'bindingRes':
          return `${show(node.lhs)} = ${show(node.rhs)}`
        case 'equation':
        case 'equationRes':
          return `${show(node.var)} ${node.params.map(show).join(' ')} = ${show(node.rhs)}`
        case 'lambdaMulti':
        case 'lambdaMultiRes':
          return `(\\${node.params.map(show).join(' ')} -> ${show(node.body)})`
        case 'lambdaRes':
          return `(\\${show(node.param)} -> ${show(node.body)})`
        case 'applyMulti':
          return `(${show(node.func)} ${node.args.map(show).join(' ')})`
        case 'apply':
          return `(${show(node.func)} ${show(node.arg)})`
        case 'infix':
          return node.args
            .map((arg, i) => `${show(arg)}${i < node.args.length - 1 ? ` ${show(node.ops[i])} ` : ''}`)
            .join('')
        case 'sectionL':
          return `(${show(node.arg)} ${show(node.op)})`
        case 'sectionR':
          return `(${show(node.op)} ${show(node.arg)})`
        case 'roll':
          return `(${node.times === null ? '' : show(node.times)}@${show(node.sides)})`
        case 'ann':
          return `(${show(node.expr)} :: ${show(node.ann)})`
        case 'typeNode':
          return TypeScheme.show(node.typeScheme)
        case 'bindingDef':
        case 'bindingDefRes':
          return show(node.binding)
        case 'equationDef':
        case 'equationDefRes':
          return show(node.equation)
        case 'equationDefGroupRes':
          return node.equationDefs.map(show).join('\n')
        case 'decl':
          return `${node.vars.map(show).join(',')} :: ${show(node.ann)}`
        case 'fixityDecl':
          return `${Fixity.show(node)} ${node.vars.map(show).join(', ')}`
        case 'dataDecl':
          return `data ${[node.id, ...node.data.typeParams].join(' ')} = ${
            node.data.cons
              .map(({ id, params }) => `${id}${params.map(param => ` ${Type.show(param)}`).join(' ')}`)
              .join(' | ')
          }`
        case 'import':
          return `import ${node.modId}`
        case 'mod':
        case 'modRes':
        case 'modDes':
          return [
            ...node.imports,
            ...node.dataDecls,
            node.bindingHost,
          ].map(show).join('\n\n')
        case 'classDef':
        case 'classDefRes':
        case 'classDefDes':
          return `class ${node.id} ${Type.show(node.param)} where\n${indent(2)(show(node.bindingHost))}`
        case 'instanceDef':
        case 'instanceDefRes':
        case 'instanceDefDes':
          return `instance ${node.classId} ${Type.show(node.arg)} where\n${indent(2)(show(node.bindingHost))}`
        case 'bindingHost':
          return [
            ...node.decls,
            ...node.fixityDecls,
            ...node.equationDefs,
            ...node.bindingDefs,
          ].map(show).join('\n\n')
        case 'bindingHostRes':
          return [
            ...values(node.declDict),
            ...values(node.fixityDict),
            ...values(node.equationDefGroupDict).flatMap(group => group.equationDefs),
            ...node.bindingDefs,
          ].map(show).join('\n\n')
        case 'bindingHostDes':
          return [
            ...values(node.declDict),
            ...values(node.fixityDict),
            ...node.bindings,
          ].map(show).join('\n\n')
        case 'lambdaCase':
        case 'lambdaCaseRes':
          return `\\case ${node.branches.map(show).join('\n')}`
        case 'list':
          return `[${node.elems.map(show).join(', ')}]`
        case 'tuple':
          return `(${node.elems.map(show).join(', ')})`
        case 'paren':
          return `(${show(node.expr)})`
      }
    },
    needsParen,
  )
}

export type NodeH<K extends NodeType, D = {}, S extends NodeStage = 'raw'> =
  K extends 'unit' ? UnitExpr<D> :
  K extends 'num' ? NumExpr<D> :
  K extends 'var' ? VarExpr<D> :
  K extends 'char' ? CharExpr<D> :
  K extends 'str' ? StrExpr<D> :
  K extends 'pattern' ? PatternS<D, S> :
  K extends 'typeNode' ? TypeNode<D> :
  K extends 'let' ? LetExpr<D> :
  K extends 'letRes' ? LetResExpr<D, S> :
  K extends 'letDes' ? LetDesExpr<D, S> :
  K extends 'case' ? CaseExpr<D, S> :
  K extends 'caseRes' ? CaseResExpr<D, S> :
  K extends 'cond' ? CondExpr<D, S> :
  K extends 'apply' ? ApplyExpr<D, S> :
  K extends 'applyMulti' ? ApplyMultiExpr<D, S> :
  K extends 'lambdaRes' ? LambdaResExpr<D, S> :
  K extends 'lambdaMulti' ? LambdaMultiExpr<D, S> :
  K extends 'lambdaMultiRes' ? LambdaMultiResExpr<D, S> :
  K extends 'lambdaCase' ? LambdaCaseExpr<D, S> :
  K extends 'lambdaCaseRes' ? LambdaCaseResExpr<D, S> :
  K extends 'ann' ? AnnExpr<D, S> :
  K extends 'binding' ? Binding<D, S> :
  K extends 'bindingRes' ? BindingRes<D, S> :
  K extends 'equation' ? Equation<D, S> :
  K extends 'equationRes' ? EquationRes<D, S> :
  K extends 'caseBranch' ? CaseBranch<D, S> :
  K extends 'caseBranchRes' ? CaseBranchRes<D, S> :
  K extends 'bindingDef' ? BindingDef<D, S> :
  K extends 'bindingDefRes' ? BindingDefRes<D, S> :
  K extends 'equationDef' ? EquationDef<D, S> :
  K extends 'equationDefRes' ? EquationDefRes<D, S> :
  K extends 'equationDefGroupRes' ? EquationDefGroupRes<D, S> :
  K extends 'decl' ? Decl<D> :
  K extends 'fixityDecl' ? FixityDecl<D> :
  K extends 'dataDecl' ? DataDecl<D> :
  K extends 'import' ? ImportDecl<D> :
  K extends 'mod' ? Mod<D, S> :
  K extends 'modRes' ? ModRes<D, S> :
  K extends 'classDef' ? ClassDef<D, S> :
  K extends 'classDefRes' ? ClassDefRes<D, S> :
  K extends 'classDefDes' ? ClassDefDes<D, S> :
  K extends 'instanceDef' ? InstanceDef<D, S> :
  K extends 'instanceDefRes' ? InstanceDefRes<D, S> :
  K extends 'instanceDefDes' ? InstanceDefDes<D, S> :
  K extends 'bindingHost' ? BindingHost<D, S> :
  K extends 'bindingHostRes' ? BindingHostRes<D, S> :
  K extends 'bindingHostDes' ? BindingHostDes<D, S> :
  K extends 'modDes' ? ModDes<D, S> :
  K extends 'roll' ? RollExpr<D, S> :
  K extends 'infix' ? InfixExpr<D, S> :
  K extends 'sectionL' ? SectionLExpr<D, S> :
  K extends 'sectionR' ? SectionRExpr<D, S> :
  K extends 'list' ? ListExpr<D, S> :
  K extends 'tuple' ? TupleExprAuto<D, S> :
  K extends 'paren' ? ParenExpr<D, S> :
  never

export const withId = <K extends NodeRawType, D>(node: NodeH<K, D>): NodeH<K, D & DId> => {
  let id = 0

  const traverse = <K extends NodeRawType>(node: NodeH<K, D>): NodeH<K, D & DId> => {
    const newNode = { ...node, astId: id ++ }

    switch (newNode.type) {
      case 'num':
      case 'unit':
      case 'var':
      case 'typeNode':
      case 'import':
        break
      case 'applyMulti':
        newNode.func = traverse<ExprRawType>(newNode.func)
        newNode.args = newNode.args.map(traverse<ExprRawType>)
        break
      case 'infix':
        newNode.ops = newNode.ops.map(traverse<'var'>)
        newNode.args = newNode.args.map(traverse<ExprRawType>)
        break
      case 'sectionL':
      case 'sectionR':
        newNode.arg = traverse<ExprRawType>(newNode.arg)
        newNode.op = traverse<'var'>(newNode.op)
        break
      case 'cond':
        newNode.cond = traverse<ExprRawType>(newNode.cond)
        newNode.yes = traverse<ExprRawType>(newNode.yes)
        newNode.no = traverse<ExprRawType>(newNode.no)
        break
      case 'roll':
        if (newNode.times !== null) newNode.times = traverse<ExprRawType>(newNode.times)
        newNode.sides = traverse<ExprRawType>(newNode.sides)
        break
      case 'let':
        newNode.bindingHost = traverse<'bindingHost'>(newNode.bindingHost)
        newNode.body = traverse<ExprRawType>(newNode.body)
        break
      case 'case':
        newNode.subject = traverse<ExprRawType>(newNode.subject)
        newNode.branches = newNode.branches.map(traverse<'caseBranch'>)
        break
      case 'lambdaMulti':
        newNode.params = newNode.params.map(traverse<'pattern'>)
        newNode.body = traverse<ExprRawType>(newNode.body)
        break
      case 'lambdaCase':
        newNode.branches = newNode.branches.map(traverse<'caseBranch'>)
        break
      case 'list':
        newNode.elems = newNode.elems.map(traverse<ExprRawType>)
        break
      case 'tuple':
        newNode.elems = newNode.elems.map(traverse<ExprRawType>)
        break
      case 'paren':
        newNode.expr = traverse<ExprRawType>(newNode.expr)
        break
      case 'caseBranch':
        newNode.pattern = traverse<'pattern'>(newNode.pattern)
        newNode.body = traverse<ExprRawType>(newNode.body)
        break
      case 'pattern':
        switch (newNode.sub) {
          case 'num':
          case 'unit':
            break
          case 'con':
            newNode.con = traverse<'var'>(newNode.con)
            newNode.args = newNode.args.map(traverse<'pattern'>)
            break
          case 'var':
            newNode.var = traverse<'var'>(newNode.var)
            break
          case 'list':
            newNode.elems = newNode.elems.map(traverse<'pattern'>)
            break
          case 'tuple':
            newNode.elems = newNode.elems.map(traverse<'pattern'>)
            break
        }
        break
      case 'binding':
        newNode.lhs = traverse<'pattern'>(newNode.lhs)
        newNode.rhs = traverse<ExprRawType>(newNode.rhs)
        break
      case 'equation':
        newNode.var = traverse<'var'>(newNode.var)
        newNode.params = newNode.params.map(traverse<'pattern'>)
        newNode.rhs = traverse<ExprRawType>(newNode.rhs)
        break
      case 'ann':
        newNode.expr = traverse<ExprRawType>(newNode.expr)
        newNode.ann = traverse<'typeNode'>(newNode.ann)
        break
      case 'bindingDef':
        newNode.binding = traverse<'binding'>(newNode.binding)
        break
      case 'equationDef':
        newNode.equation = traverse<'equation'>(newNode.equation)
        break
      case 'decl':
        newNode.vars = newNode.vars.map(traverse<'var'>)
        newNode.ann = traverse<'typeNode'>(newNode.ann)
        break
      case 'fixityDecl':
        newNode.vars = newNode.vars.map(traverse<'var'>)
        break
      case 'dataDecl':
        break
      case 'classDef':
      case 'instanceDef':
        newNode.bindingHost = traverse<'bindingHost'>(newNode.bindingHost)
        break
      case 'mod':
        newNode.imports = newNode.imports.map(traverse<'import'>)
        newNode.bindingHost = traverse<'bindingHost'>(newNode.bindingHost)
        newNode.dataDecls = newNode.dataDecls.map(traverse<'dataDecl'>)
        newNode.classDefs = newNode.classDefs.map(traverse<'classDef'>)
        newNode.instanceDefs = newNode.instanceDefs.map(traverse<'instanceDef'>)
        break
      case 'bindingHost':
        newNode.decls = newNode.decls.map(traverse<'decl'>)
        newNode.fixityDecls = newNode.fixityDecls.map(traverse<'fixityDecl'>)
        newNode.bindingDefs = newNode.bindingDefs.map(traverse<'bindingDef'>)
        newNode.equationDefs = newNode.equationDefs.map(traverse<'equationDef'>)
        break
    }
    return newNode as NodeH<K, D & DId>
  }

  return traverse(node) as NodeH<K, D & DId>
}
