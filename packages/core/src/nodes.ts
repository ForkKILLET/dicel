import { Range } from 'parsecond'
import { match } from 'ts-pattern'
import { describeToShow } from './utils'
import { Type } from './types'
import { Data } from './data'
import { isSymbolOrComma } from './lex'
import { Fixity } from './parse'

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

export type LetExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'let'
  bindings: Binding<D, S>[]
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

export type PatternInt<D = {}, S extends NodeStage = 'int'> =
  | WildcardPattern<D>
  | NumPattern<D>
  | UnitPattern<D>
  | VarPattern<D>
  | ConPattern<D, S>

export type PatternExt<D = {}, S extends NodeStage = 'raw'> =
  | ListPattern<D, S>
  | TuplePattern<D, S>

export type Pattern<D = {}> =
  | PatternInt<D, 'raw'>
  | PatternExt<D>

export type PatternS<D, S extends NodeStage> = {
  raw: Pattern<D>
  int: PatternInt<D>
}[S]

export type CaseBranch<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'caseBranch'
  pattern: PatternS<D, S>
  body: ExprS<D, S>
}

export type CaseExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'case'
  subject: ExprS<D, S>
  branches: CaseBranch<D, S>[]
}

export type LambdaMultiExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'lambdaMulti'
  params: PatternS<D, S>[]
  body: ExprS<D, S>
}

export type LambdaExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'lambda'
  param: PatternS<D, S>
  body: ExprS<D, S>
}

export type LambdaCaseExpr<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'lambdaCase'
  branches: CaseBranch<D, S>[]
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

export type DataDef<D = {}> = D & {
  type: 'dataDef'
  id: string
  data: Data
}

export type Import<D = {}> = D & {
  type: 'import'
  modName: string
  ids: string[]
}

export type Mod<D = {}, S extends NodeStage = 'raw'> = D & {
  type: 'mod'
  imports: Import<D>[]
  defs: Def<D, S>[]
  decls: Decl<D>[]
  fixityDecls: FixityDecl<D>[]
  dataDefs: DataDef<D>[]
}

export type Class = {
  typeParams: string[]
  defs: Def[]
}
export type ClassDef = {
  type: 'classDef'
  id: string
  class: Class
}

export type ExprInt<D = {}, S extends NodeStage = 'int'> =
  | UnitExpr<D>
  | NumExpr<D>
  | VarExpr<D>
  | LetExpr<D, S>
  | CaseExpr<D, S>
  | CondExpr<D, S>
  | ApplyExpr<D, S>
  | LambdaExpr<D, S>
  | AnnExpr<D, S>

export type ExprExt<D = {}> =
  | RollExpr<D>
  | InfixExpr<D>
  | SectionLExpr<D>
  | SectionRExpr<D>
  | ApplyMultiExpr<D>
  | LambdaMultiExpr<D>
  | LambdaCaseExpr<D>
  | ListExpr<D>
  | TupleExpr<D>
  | ParenExpr<D>

export type Expr<D = {}> =
  | ExprInt<D, 'raw'>
  | ExprExt<D>

export type ExprS<D, S extends NodeStage> = {
  raw: Expr<D>
  int: ExprInt<D>
}[S]

export type NodeInt<D = {}, S extends NodeStage = 'raw'> =
  | ExprInt<D, S>
  | PatternInt<D, S>
  | Binding<D>
  | TypeNode<D>
  | CaseBranch<D>
  | Pattern<D>
  | Def<D>
  | Decl<D>
  | FixityDecl<D>
  | DataDef<D>
  | Import<D>
  | Mod<D>

export type NodeExt<D = {}> =
  | ExprExt<D>
  | PatternExt<D>

export type Node<D = {}> =
  | NodeInt<D, 'raw'>
  | NodeExt<D>

export type NodeS<D, S extends NodeStage> = {
  raw: Node<D>
  int: NodeInt<D>
}[S]

export type NodeStage = 'raw' | 'int'

export interface ExprSIdToPatternSIdMap {
  'raw': '@pattern'
  'int': '@patternInt'
}

export type ExprType = Expr['type']
export type NodeType = Node['type']

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
      self.type === 'lambda' ||
      self.type === 'apply' && self === parent.arg
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
      .with({ type: 'lambdaMulti' }, expr =>
        `(\\${expr.params.map(show).join(' ')} -> ${show(expr.body)})`
      )
      .with({ type: 'lambda' }, expr =>
        `(\\${show(expr.param)} -> ${show(expr.body)})`
      )
      .with({ type: 'applyMulti' }, expr =>
        `(${show(expr.func)} ${expr.args.map(show).join(' ')})`
      )
      .with({ type: 'apply' }, expr =>
        `(${show(expr.func)} ${show(expr.arg)})`
      )
      .with({ type: 'infix' }, expr =>
        expr.args
          .map((arg, i) => `${show(arg)}${ i < expr.args.length - 1 ? ` ${show(expr.ops[i])} ` : ''}`)
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
      .with({ type: 'def' }, def => show(def.binding))
      .with({ type: 'decl' }, decl =>
        `${decl.vars.map(show).join(',')} :: ${show(decl.ann)}`
      )
      .with({ type: 'fixityDecl' }, decl =>
        `${Fixity.show(decl)} ${decl.vars.map(show).join(', ')}`
      )
      .with({ type: 'dataDef' }, def =>
        `data ${[def.id, ...def.data.typeParams].join(' ')} = ${
          def.data.cons
            .map(({ id, params }) => `${id}${params.map(param => ` ${Type.show(param)}`).join(' ')}`)
            .join(' | ')
        }`
      )
      .with({ type: 'import' }, ({ modName: mod }) =>
        `import ${mod}`
      )
      .with({ type: 'mod' }, mod => [
        ...mod.dataDefs,
        ...mod.decls,
        ...mod.defs,
        ...mod.fixityDecls,
      ].map(show).join('\n\n'))
      .with({ type: 'lambdaCase' }, expr =>
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
  case: CaseExpr<D, S>
  cond: CondExpr<D, S>
  apply: ApplyExpr<D, S>
  applyMulti: ApplyMultiExpr<D, S>
  lambda: LambdaExpr<D, S>
  lambdaMulti: LambdaMultiExpr<D, S>
  lambdaCase: LambdaCaseExpr<D, S>
  ann: AnnExpr<D, S>
  binding: Binding<D, S>
  caseBranch: CaseBranch<D, S>
  def: Def<D, S>
  decl: Decl<D>
  fixityDecl: FixityDecl<D>
  dataDef: DataDef<D>
  import: Import<D>
  mod: Mod<D, S>
  roll: RollExpr<D, S>
  infix: InfixExpr<D, S>
  sectionL: SectionLExpr<D, S>
  sectionR: SectionRExpr<D, S>
  list: ListExpr<D, S>
  tuple: TupleExpr<D, S>
  paren: ParenExpr<D, S>
}[K]

export const withId = <K extends NodeType, D>(node: NodeH<K, D>): NodeH<K, D & DId> => {
  let id = 0

  const traverse = <K extends NodeType>(node: NodeH<K, D>): NodeH<K, D & DId> => {
    const newNode = { ...node, astId: id ++ }

    switch (newNode.type) {
      case 'num':
      case 'var':
      case 'typeNode':
      case 'unit':
        break
      case 'apply':
        newNode.func = traverse<ExprType>(newNode.func)
        newNode.arg = traverse<ExprType>(newNode.arg)
        break
      case 'applyMulti':
        newNode.func = traverse<ExprType>(newNode.func)
        newNode.args = newNode.args.map(traverse<ExprType>)
        break
      case 'infix':
        newNode.ops = newNode.ops.map(traverse<'var'>)
        newNode.args = newNode.args.map(traverse<ExprType>)
        break
      case 'sectionL':
      case 'sectionR':
        newNode.arg = traverse<ExprType>(newNode.arg)
        newNode.op = traverse<'var'>(newNode.op)
        break
      case 'cond':
        newNode.cond = traverse<ExprType>(newNode.cond)
        newNode.yes = traverse<ExprType>(newNode.yes)
        newNode.no = traverse<ExprType>(newNode.no)
        break
      case 'roll':
        if (newNode.times !== null) newNode.times = traverse<ExprType>(newNode.times)
        newNode.sides = traverse<ExprType>(newNode.sides)
        break
      case 'let':
        newNode.bindings = newNode.bindings.map(traverse<'binding'>)
        newNode.body = traverse<ExprType>(newNode.body)
        break
      case 'case':
        newNode.subject = traverse<ExprType>(newNode.subject)
        newNode.branches = newNode.branches.map(traverse<'caseBranch'>)
        break
      case 'lambda':
        newNode.param = traverse<'pattern'>(newNode.param)
        newNode.body = traverse<ExprType>(newNode.body)
        break
      case 'lambdaMulti':
        newNode.params = newNode.params.map(traverse<'pattern'>)
        newNode.body = traverse<ExprType>(newNode.body)
        break
      case 'lambdaCase':
        newNode.branches = newNode.branches.map(traverse<'caseBranch'>)
        break
      case 'list':
        newNode.elems = newNode.elems.map(traverse<ExprType>)
        break
      case 'tuple':
        newNode.elems = newNode.elems.map(traverse<ExprType>)
        break
      case 'paren':
        newNode.expr = traverse<ExprType>(newNode.expr)
        break
      case 'caseBranch':
        newNode.pattern = traverse<'pattern'>(newNode.pattern)
        newNode.body = traverse<ExprType>(newNode.body)
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
        newNode.rhs = traverse<ExprType>(newNode.rhs)
        break
      case 'ann':
        newNode.expr = traverse<ExprType>(newNode.expr)
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
      case 'dataDef':
        break
      case 'mod':
        newNode.imports = newNode.imports.map(traverse<'import'>)
        newNode.defs = newNode.defs.map(traverse<'def'>)
        newNode.decls = newNode.decls.map(traverse<'decl'>)
        newNode.fixityDecls = newNode.fixityDecls.map(traverse<'fixityDecl'>)
        newNode.dataDefs = newNode.dataDefs.map(traverse<'dataDef'>)
        break
    }
    return newNode as NodeH<K, D & DId>
  }

  return traverse(node) as NodeH<K, D & DId>
}
