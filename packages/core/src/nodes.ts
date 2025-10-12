import { Range } from 'parsecond'
import { match } from 'ts-pattern'
import { describeToShow, Dict } from './utils'
import { KindEnv, Type } from './types'
import { Data } from './data'
import { isSymbolOrComma } from './lex'
import { Fixity } from './lex'

export type DRange = { range: Range }
export type DId = { astId: number }

export type NumExpr<D = {}> = D & {
  type: 'num'
  val: number
}
export type UnitExpr<D = {}> = D & {
  type: 'unit'
}

export type TupleExpr<D = {}, S extends NodeStage = 'raw'> = D & {
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

export type LetExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'let'
  bindings: Binding<D, S>[]
  body: ExprS<D, S>
}

export type LetResExpr<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'letRes'
  bindings: BindingRes<D, S>[]
  idSet: Set<string>
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
  val: Type
}

export type AnnExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'ann'
  expr: ExprS<D, S>
  ann: TypeNode<D>
}

export type Def<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'def'
  binding: Binding<D, S>
}

export type DefRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'defRes'
  binding: BindingRes<D, S>
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
  ids: string[]
}

export type Import = {
  modId: string
}

export type Mod<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'mod'
  defs: Def<D, S>[]
  imports: ImportDecl<D>[]
  decls: Decl<D>[]
  fixityDecls: FixityDecl<D>[]
  dataDecls: DataDecl<D>[]
}

export type ModRes<D = {}, S extends NodeStage = 'res'> = D & {
  type: 'modRes'
  defs: DefRes<D, S>[]
  imports: ImportDecl<D>[]
  decls: Decl<D>[]
  fixityDecls: FixityDecl<D>[]
  dataDecls: DataDecl<D>[]

  defIdSet: Set<string>
  dataConIdSet: Set<string>
  importDict: Dict<Import>
  importModIdSet: Set<string>
  declDict: Dict<Decl>
  fixityDict: Dict<Fixity>
  dataDict: Dict<Data>
}

export type ModDes = ModRes<{}, 'des'>

export type Class = {
  typeParams: string[]
  defs: Def[]
}
export type ClassDef = {
  type: 'classDef'
  id: string
  class: Class
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
  | TupleExpr<D, S>
  | ParenExpr<D, S>

export type ExprRawToDes<D = {}, S extends NodeStage = 'raw'> =
  | NumExpr<D>
  | UnitExpr<D>
  | VarExpr<D>
  | AnnExpr<D, S>
  | CondExpr<D, S>

export type ExprRaw<D = {}> =
  | ExprRawToRaw<D, 'raw'>
  | ExprRawToRes<D, 'raw'>
  | ExprRawToDes<D, 'raw'>

export type ExprResToRes<D = {}, S extends NodeStage = 'res'> =
  | LambdaCaseResExpr<D, S>
  | LambdaMultiResExpr<D, S>

export type ExprResToDes<D = {}, S extends NodeStage = 'res'> =
  | LetResExpr<D, S>
  | CaseResExpr<D, S>

export type ExprRes<D = {}> =
  | ExprRawToRes<D, 'res'>
  | ExprRawToDes<D, 'res'>
  | ExprResToRes<D, 'res'>
  | ExprResToDes<D, 'res'>

export type ExprDesToDes<D = {}, S extends NodeStage = 'des'> =
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
  | Def<D, S>
  | Decl<D>
  | DataDecl<D>
  | ImportDecl<D>
  | FixityDecl<D>
  | CaseBranch<D, S>
  | Binding<D, S>

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

export type NodeResToDes<D = {}, S extends NodeStage = 'res'> =
  | ExprResToDes<D, S>
  | PatternResToDes<D, S>
  | ModRes<D, S>
  | DefRes<D, S>
  | CaseBranchRes<D, S>
  | BindingRes<D, S>

export type NodeRes<D = {}> =
  | NodeRawToRes<D, 'res'>
  | NodeRawToDes<D, 'res'>
  | NodeResToRes<D, 'res'>
  | NodeResToDes<D, 'res'>

export type NodeDesToDes<D = {}, S extends NodeStage = 'des'> =
  | ExprDesToDes<D, S>
  | PatternDesToDes<D, S>

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
      .with({ sub: 'tuple' }, ({ elems }) => `(${elems.map(show).join(', ')})`)
      .with({ sub: 'list' }, ({ elems }) => `[${elems.map(show).join(', ')}]`)
      .exhaustive(),
    needsParen,
  )
}

export namespace Node {
  export const is = <const Ts extends NodeType[]>(node: Node, types: Ts): node is Node & { type: Ts[number] } => types.includes(node.type)

  export const needsParen = (self: Node, parent: Node | null): boolean =>
    self.type === 'var' && (
      isSymbolOrComma(self.id) && (! parent || ! Array.of<NodeType>('infix', 'sectionL', 'sectionR').includes(parent?.type))
    ) ||
    self.type === 'sectionL' || self.type === 'sectionR' ||
    parent?.type === 'apply' && (
      self.type === 'lambdaRes' ||
      self.type === 'apply' && self === parent.arg
    )

  export const show = describeToShow<Node, Node>(
    expr => expr,
    (expr, show): string => match<Node, string>(expr)
      .with({ type: 'num' }, expr => String(expr.val))
      .with({ type: 'unit' }, () => '()')
      .with({ type: 'var' }, expr => expr.id)
      .with({ type: 'cond' }, expr =>
        `${show(expr.cond)} ? ${show(expr.yes)} : ${show(expr.no)}`
      )
      .with({ type: 'let' }, { type: 'letRes' }, expr =>
        `let ${expr.bindings.map(show).join('; ')} in ${show(expr.body)}`
      )
      .with({ type: 'case' }, { type: 'caseRes' }, expr =>
        `case ${show(expr.subject)} of ${expr.branches.map(show).join('; ')}`
      )
      .with({ type: 'caseBranch' }, { type: 'caseBranchRes' }, branch =>
        `${show(branch.pattern)} -> ${show(branch.body)}`
      )
      .with({ type: 'pattern' }, Pattern.show)
      .with({ type: 'binding' }, { type: 'bindingRes' },
        binding => `${show(binding.lhs)} = ${show(binding.rhs)}`
      )
      .with({ type: 'lambdaMulti' }, { type: 'lambdaMultiRes' }, expr =>
        `(\\${expr.params.map(show).join(' ')} -> ${show(expr.body)})`
      )
      .with({ type: 'lambdaRes' }, expr =>
        `(\\${show(expr.param)} -> ${show(expr.body)})`
      )
      .with({ type: 'applyMulti' }, expr =>
        `(${show(expr.func)} ${expr.args.map(show).join(' ')})`
      )
      .with({ type: 'apply' }, expr =>
        `(${show(expr.func)} ${show(expr.arg)})`
      )
      .with({ type: 'infix' }, expr => expr.args
        .map((arg, i) => `${show(arg)}${i < expr.args.length - 1 ? ` ${show(expr.ops[i])} ` : ''}`)
        .join('')
      )
      .with({ type: 'sectionL' }, expr =>
        `(${show(expr.arg)} ${show(expr.op)})`
      )
      .with({ type: 'sectionR' }, expr =>
        `(${show(expr.op)} ${show(expr.arg)})`
      )
      .with({ type: 'roll' }, expr =>
        `(${expr.times === null ? '' : show(expr.times)}@${show(expr.sides)})`
      )
      .with({ type: 'ann' }, expr =>
        `(${show(expr.expr)} :: ${show(expr.ann)})`
      )
      .with({ type: 'typeNode' }, type => Type.show(type.val))
      .with({ type: 'def' }, { type: 'defRes' }, def => show(def.binding))
      .with({ type: 'decl' }, decl =>
        `${decl.vars.map(show).join(',')} :: ${show(decl.ann)}`
      )
      .with({ type: 'fixityDecl' }, decl =>
        `${Fixity.show(decl)} ${decl.vars.map(show).join(', ')}`
      )
      .with({ type: 'dataDecl' }, def =>
        `data ${[def.id, ...def.data.typeParams].join(' ')} = ${
          def.data.cons
            .map(({ id, params }) => `${id}${params.map(param => ` ${Type.show(param)}`).join(' ')}`)
            .join(' | ')
        }`
      )
      .with({ type: 'import' }, ({ modId: mod }) =>
        `import ${mod}`
      )
      .with({ type: 'mod' }, mod => [
        ...mod.dataDecls,
        ...mod.decls,
        ...mod.defs,
        ...mod.fixityDecls,
      ].map(show).join('\n\n'))
      .with({ type: 'modRes' }, _mod => '<mod>') // TODO
      .with({ type: 'lambdaCase' }, { type: 'lambdaCaseRes' }, expr =>
        `\case ${expr.branches.map(show).join('; ')}`
      )
      .with({ type: 'list' }, expr =>
        `[${expr.elems.map(show).join(', ')}]`
      )
      .with({ type: 'tuple' }, expr =>
        `(${expr.elems.map(show).join(', ')})`
      )
      .with({ type: 'paren' }, expr => `(${show(expr.expr)})`)
      .exhaustive(),
    needsParen,
  )
}

export type NodeH<K extends NodeType, D = {}, S extends NodeStage = 'raw'> = {
  unit: UnitExpr<D>
  num: NumExpr<D>
  var: VarExpr<D>
  pattern: PatternS<D, S>
  typeNode: TypeNode<D>
  let: LetExpr<D>
  letRes: LetResExpr<D, S>
  case: CaseExpr<D, S>
  caseRes: CaseResExpr<D, S>
  cond: CondExpr<D, S>
  apply: ApplyExpr<D, S>
  applyMulti: ApplyMultiExpr<D, S>
  lambdaRes: LambdaResExpr<D, S>
  lambdaMulti: LambdaMultiExpr<D, S>
  lambdaMultiRes: LambdaMultiResExpr<D, S>
  lambdaCase: LambdaCaseExpr<D, S>
  lambdaCaseRes: LambdaCaseResExpr<D, S>
  ann: AnnExpr<D, S>
  binding: Binding<D, S>
  bindingRes: BindingRes<D, S>
  caseBranch: CaseBranch<D, S>
  caseBranchRes: CaseBranchRes<D, S>
  def: Def<D, S>
  defRes: DefRes<D, S>
  decl: Decl<D>
  fixityDecl: FixityDecl<D>
  dataDecl: DataDecl<D>
  import: ImportDecl<D>
  mod: Mod<D, S>
  modRes: ModRes<D, S>
  roll: RollExpr<D, S>
  infix: InfixExpr<D, S>
  sectionL: SectionLExpr<D, S>
  sectionR: SectionRExpr<D, S>
  list: ListExpr<D, S>
  tuple: TupleExpr<D, S>
  paren: ParenExpr<D, S>
}[K]

export const withId = <K extends NodeRawType, D>(node: NodeH<K, D>): NodeH<K, D & DId> => {
  let id = 0

  const traverse = <K extends NodeRawType>(node: NodeH<K, D>): NodeH<K, D & DId> => {
    const newNode = { ...node, astId: id ++ }

    switch (newNode.type) {
      case 'num':
      case 'var':
      case 'typeNode':
      case 'unit':
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
        newNode.bindings = newNode.bindings.map(traverse<'binding'>)
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
      case 'ann':
        newNode.expr = traverse<ExprRawType>(newNode.expr)
        newNode.ann = traverse<'typeNode'>(newNode.ann)
        break
      case 'def':
        newNode.binding = traverse<'binding'>(newNode.binding)
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
      case 'mod':
        newNode.imports = newNode.imports.map(traverse<'import'>)
        newNode.defs = newNode.defs.map(traverse<'def'>)
        newNode.decls = newNode.decls.map(traverse<'decl'>)
        newNode.fixityDecls = newNode.fixityDecls.map(traverse<'fixityDecl'>)
        newNode.dataDecls = newNode.dataDecls.map(traverse<'dataDecl'>)
        break
    }
    return newNode as NodeH<K, D & DId>
  }

  return traverse(node) as NodeH<K, D & DId>
}
