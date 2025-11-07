import { Range } from 'parsecond'

import { Type, TypeScheme, VarType } from '@/type/type'
import { Fixity } from '@/fixity'

import { Core, NodeStage, Surface0, Surface1R } from '@/node/stage'
import { AstId } from '@/node/astId'
import { SymIdHeadByStage } from '@/sym'
import { Show } from '@/utils/types'

// Base

export type InNodeStage<S0 extends NodeStage, S extends NodeStage, T> =
  S extends S0 ? T : never

export type NodeHead = {
  astId: AstId
  range: Range
}

export type NodeFieldType = 'node' | 'node?' | 'node[]' | 'node[]?'

export type NodeFields<T extends Node> = {
  [P in keyof T as
    Exclude<T[P], null> extends Node ? P :
    Exclude<T[P], null> extends Node[] ? P :
    never
  ]: (
    T[P] extends Node[] ? 'node[]' :
    T[P] extends Node[] | null ? 'node[]?' :
    T[P] extends Node ? 'node' :
    T[P] extends Node | null ? 'node?' :
    never
  )
}

export type NodeMeta<K extends NodeTy> = NodeFields<NodeOfTy<NodeStage, K>>

export const NodeMeta = <K extends NodeTy>(meta: NodeMeta<K>) => meta

// Node types

export interface NumExprB {
  ty: 'num'
  val: number
}
export interface NumExpr extends NumExprB, NodeHead {}

export interface UnitExprB {
  ty: 'unit'
}
export interface UnitExpr extends UnitExprB, NodeHead {}

export interface CharExprB {
  ty: 'char'
  val: string
}
export interface CharExpr extends CharExprB, NodeHead {}

export interface StrExprB {
  ty: 'str'
  val: string
}
export interface StrExpr extends StrExprB, NodeHead {}

export type VarExprB<S extends NodeStage = NodeStage> = SymIdHeadByStage<S> & {
  ty: 'var'
  id: IdNode
}
export type VarExpr<S extends NodeStage = NodeStage> = VarExprB<S> & NodeHead

export interface ApplyMultiExprB<S extends NodeStage = NodeStage> {
  ty: 'applyMulti'
  func: Expr<S>
  args: Expr<S>[]
}
export interface ApplyMultiExpr<S extends NodeStage = NodeStage> extends ApplyMultiExprB<S>, NodeHead {}

export interface ApplyExprB<S extends NodeStage = NodeStage> {
  ty: 'apply'
  func: Expr<S>
  arg: Expr<S>
}
export interface ApplyExpr<S extends NodeStage = NodeStage> extends ApplyExprB<S>, NodeHead {}

export interface InfixExprB<S extends NodeStage = NodeStage> {
  ty: 'infix'
  ops: VarExpr<S>[]
  args: Expr<S>[]
}
export interface InfixExpr<S extends NodeStage = NodeStage> extends InfixExprB<S>, NodeHead {}

export interface SectionLExprB<S extends NodeStage = NodeStage> {
  ty: 'sectionL'
  op: VarExpr<S>
  arg: Expr<S>
}
export interface SectionLExpr<S extends NodeStage = NodeStage> extends SectionLExprB<S>, NodeHead {}

export interface SectionRExprB<S extends NodeStage = NodeStage> {
  ty: 'sectionR'
  op: VarExpr<S>
  arg: Expr<S>
}
export interface SectionRExpr<S extends NodeStage = NodeStage> extends SectionRExprB<S>, NodeHead {}

export interface RollExprB<S extends NodeStage = NodeStage> {
  ty: 'roll'
  times: Expr<S> | null
  sides: Expr<S>
}
export interface RollExpr<S extends NodeStage = NodeStage> extends RollExprB<S>, NodeHead {}

export interface ParenExprB<S extends NodeStage = NodeStage> {
  ty: 'paren'
  expr: Expr<S>
}
export interface ParenExpr<S extends NodeStage = NodeStage> extends ParenExprB<S>, NodeHead {}

export interface TupleExprB<S extends NodeStage = NodeStage> {
  ty: 'tuple'
  elems: Expr<S>[]
}
export interface TupleExpr<S extends NodeStage = NodeStage> extends TupleExprB<S>, NodeHead {}

export interface ListExprB<S extends NodeStage = NodeStage> {
  ty: 'list'
  elems: Expr<S>[]
}
export interface ListExpr<S extends NodeStage = NodeStage> extends ListExprB<S>, NodeHead {}

export interface RecordPunningFieldNodeB {
  ty: 'recordPunningField'
  key: IdNode
}
export interface RecordPunningFieldNode extends RecordPunningFieldNodeB, NodeHead {}

export interface RecordBindingFieldNodeB<S extends NodeStage = NodeStage> {
  ty: 'recordBindingField'
  key: IdNode
  val: Expr<S>
}
export interface RecordBindingFieldNode<S extends NodeStage = NodeStage> extends RecordBindingFieldNodeB<S>, NodeHead {}

export type RecordFieldNodeB<S extends NodeStage = NodeStage> =
  | InNodeStage<S, Surface0, RecordPunningFieldNodeB>
  | RecordBindingFieldNodeB<S>
export type RecordFieldNode<S extends NodeStage = NodeStage> = RecordFieldNodeB<S> & NodeHead

export interface RecordExprB<S extends NodeStage = NodeStage> {
  ty: 'record'
  con: VarRefNode<S>
  fields: RecordFieldNode<S>[]
}
export interface RecordExpr<S extends NodeStage = NodeStage> extends RecordExprB<S>, NodeHead {}

export interface RecordUpdatePunningMatchingFieldNodeB<S extends NodeStage = NodeStage> {
  ty: 'recordUpdatePunningMatchingField'
  key: IdNode
  body: Expr<S>
}
export interface RecordUpdatePunningMatchingFieldNode<S extends NodeStage = NodeStage> extends RecordUpdatePunningMatchingFieldNodeB<S>, NodeHead {}

export interface RecordUpdatePipeFieldNodeB<S extends NodeStage = NodeStage> {
  ty: 'recordUpdatePipeField'
  key: IdNode
  func: Expr<S>
}
export interface RecordUpdatePipeFieldNode<S extends NodeStage = NodeStage> extends RecordUpdatePipeFieldNodeB<S>, NodeHead {}

export interface RecordUpdateMatchingFieldNodeB<S extends NodeStage = NodeStage> {
  ty: 'recordUpdateMatchingField'
  key: IdNode
  pat: Pat<S>
  body: Expr<S>
}
export interface RecordUpdateMatchingFieldNode<S extends NodeStage = NodeStage> extends RecordUpdateMatchingFieldNodeB<S>, NodeHead {}

export type RecordUpdateFieldNodeB<S extends NodeStage = NodeStage> =
  | InNodeStage<S, Surface0, RecordUpdatePunningMatchingFieldNodeB<S>>
  | InNodeStage<S, Surface0, RecordUpdatePipeFieldNodeB<S>>
  | RecordUpdateMatchingFieldNodeB<S>
export type RecordUpdateFieldNode<S extends NodeStage = NodeStage> = RecordUpdateFieldNodeB<S> & NodeHead

export interface RecordUpdateExprB<S extends NodeStage = NodeStage> {
  ty: 'recordUpdate'
  con: VarRefNode<S>
  fields: RecordUpdateFieldNode<S>[]
}
export interface RecordUpdateExpr<S extends NodeStage = NodeStage> extends RecordUpdateExprB<S>, NodeHead {}

export type VarRefNodeB<S extends NodeStage = NodeStage> = SymIdHeadByStage<S> & {
  ty: 'varRef'
  id: IdNode
}
export type VarRefNode<S extends NodeStage = NodeStage> = VarRefNodeB<S> & NodeHead

export interface WildcardPatB {
  ty: 'wildcardPat'
}
export interface WildcardPat extends WildcardPatB, NodeHead {}

export interface NumPatB {
  ty: 'numPat'
  val: number
}
export interface NumPat extends NumPatB, NodeHead {}

export interface UnitPatB {
  ty: 'unitPat'
}
export interface UnitPat extends UnitPatB, NodeHead {}

export interface InfixPatB<S extends NodeStage = NodeStage> {
  ty: 'infixPat'
  ops: VarRefNode<S>[]
  args: Pat<S>[]
}
export interface InfixPat<S extends NodeStage = NodeStage> extends InfixPatB<S>, NodeHead {}

export interface DataPatB<S extends NodeStage = NodeStage> {
  ty: 'dataPat'
  con: VarRefNode<S>
  args: Pat<S>[]
}
export interface DataPat<S extends NodeStage = NodeStage> extends DataPatB<S>, NodeHead {}

export type VarPatB<S extends NodeStage = NodeStage> = SymIdHeadByStage<S> & {
  ty: 'varPat'
  id: IdNode
}
export type VarPat<S extends NodeStage = NodeStage> = VarPatB<S> & NodeHead

export interface TuplePatB<S extends NodeStage = NodeStage> {
  ty: 'tuplePat'
  elems: Pat<S>[]
}
export interface TuplePat<S extends NodeStage = NodeStage> extends TuplePatB<S>, NodeHead {}

export interface ListPatB<S extends NodeStage = NodeStage> {
  ty: 'listPat'
  elems: Pat<S>[]
}
export interface ListPat<S extends NodeStage = NodeStage> extends ListPatB<S>, NodeHead {}

export interface RecordPatPunningFieldNodeB {
  ty: 'recordPatPunningField'
  key: IdNode
}
export interface RecordPatPunningFieldNode extends RecordPatPunningFieldNodeB, NodeHead {}

export interface RecordPatRebindingFieldNodeB<S extends NodeStage = NodeStage> {
  ty: 'recordPatRebindingField'
  key: IdNode
  pat: Pat<S>
}
export interface RecordPatRebindingFieldNode<S extends NodeStage = NodeStage> extends RecordPatRebindingFieldNodeB<S>, NodeHead {}

export type RecordPatFieldNodeB<S extends NodeStage = NodeStage> =
  | InNodeStage<S, Surface0, RecordPatPunningFieldNodeB>
  | RecordPatRebindingFieldNodeB<S>
export type RecordPatFieldNode<S extends NodeStage = NodeStage> = RecordPatFieldNodeB<S> & NodeHead

export interface RecordPatB<S extends NodeStage = NodeStage> {
  ty: 'recordPat'
  con: VarRefNode<S>
  fields: RecordPatFieldNode<S>[]
}
export interface RecordPat<S extends NodeStage = NodeStage> extends RecordPatB<S>, NodeHead {}

export interface LetExprB<S extends NodeStage = NodeStage> {
  ty: 'let'
  bindingHost: BindingHostNode<S>
  body: Expr<S>
}
export interface LetExpr<S extends NodeStage = NodeStage> extends LetExprB<S>, NodeHead {}

export interface CondExprB<S extends NodeStage = NodeStage> {
  ty: 'cond'
  cond: Expr<S>
  yes: Expr<S>
  no: Expr<S>
}
export interface CondExpr<S extends NodeStage = NodeStage> extends CondExprB<S>, NodeHead {}

export interface CaseBranchNodeB<S extends NodeStage = NodeStage> {
  ty: 'caseBranch'
  pat: Pat<S>
  body: Expr<S>
}
export interface CaseBranchNode<S extends NodeStage = NodeStage> extends CaseBranchNodeB<S>, NodeHead {}

export interface CaseExprB<S extends NodeStage = NodeStage> {
  ty: 'case'
  scrutinee: Expr<S>
  branches: CaseBranchNode<S>[]
}
export interface CaseExpr<S extends NodeStage = NodeStage> extends CaseExprB<S>, NodeHead {}

export interface AnnExprB<S extends NodeStage = NodeStage> {
  ty: 'ann'
  expr: Expr<S>
  ann: TypeSchemeNode
}
export interface AnnExpr<S extends NodeStage = NodeStage> extends AnnExprB<S>, NodeHead {}

export interface LambdaMultiExprB<S extends NodeStage = NodeStage> {
  ty: 'lambdaMulti'
  params: Pat<S>[]
  body: Expr<S>
}
export interface LambdaMultiExpr<S extends NodeStage = NodeStage> extends LambdaMultiExprB<S>, NodeHead {}

export interface LambdaCaseExprB<S extends NodeStage = NodeStage> {
  ty: 'lambdaCase'
  branches: CaseBranchNode<S>[]
}
export interface LambdaCaseExpr<S extends NodeStage = NodeStage> extends LambdaCaseExprB<S>, NodeHead {}

export interface LambdaExprB<S extends NodeStage = NodeStage> {
  ty: 'lambda'
  param: Pat<S>
  body: Expr<S>
}
export interface LambdaExpr<S extends NodeStage = NodeStage> extends LambdaExprB<S>, NodeHead {}

export interface IdNodeB {
  ty: 'id'
  id: string
  style: 'big' | 'small' | 'sym' | 'other'
}
export interface IdNode extends IdNodeB, NodeHead {}

export interface TypeNodeB<T extends Type = Type> {
  ty: 'type'
  type: T
}
export interface TypeNode<T extends Type = Type> extends TypeNodeB<T>, NodeHead {}

export interface TypeSchemeNodeB {
  ty: 'typeScheme'
  typeScheme: TypeScheme
  isImplicit: boolean
}
export interface TypeSchemeNode extends TypeSchemeNodeB, NodeHead {}

export interface BindingNodeB<S extends NodeStage = NodeStage> {
  ty: 'binding'
  pat: Pat<S>
  body: Expr<S>
}
export interface BindingNode<S extends NodeStage = NodeStage> extends BindingNodeB<S>, NodeHead {}

export interface EquationApplyFlattenHeadNodeB<S extends NodeStage = NodeStage> {
  ty: 'equationApplyFlattenHead'
  func: VarRefNode<S>
  params: Pat<S>[]
}
export interface EquationApplyFlattenHeadNode<S extends NodeStage = NodeStage> extends EquationApplyFlattenHeadNodeB<S>, NodeHead {}

export interface EquationApplyHeadNodeB<S extends NodeStage = NodeStage> {
  ty: 'equationApplyHead'
  func: VarRefNode<S> | EquationHeadNode<S>
  params: Pat<S>[]
}
export interface EquationApplyHeadNode<S extends NodeStage = NodeStage> extends EquationApplyHeadNodeB<S>, NodeHead {}

export interface EquationInfixHeadNodeB<S extends NodeStage = NodeStage> {
  ty: 'equationInfixHead'
  lhs: Pat<S>
  op: VarRefNode<S>
  rhs: Pat<S>
}
export interface EquationInfixNode<S extends NodeStage = NodeStage> extends EquationInfixHeadNodeB<S>, NodeHead {}

export type EquationHeadNodeB<S extends NodeStage = NodeStage> =
  | InNodeStage<Surface0, S, EquationApplyHeadNodeB<S>>
  | InNodeStage<Surface0, S, EquationInfixHeadNodeB<S>>
  | InNodeStage<Surface1R, S, EquationApplyFlattenHeadNodeB<S>>
export type EquationHeadNode<S extends NodeStage = NodeStage> = EquationHeadNodeB<S> & NodeHead

export interface EquationNodeB<S extends NodeStage = NodeStage> {
  ty: 'equation'
  head: EquationHeadNode<S>
  body: Expr<S>
}
export interface EquationNode<S extends NodeStage = NodeStage> extends EquationNodeB<S>, NodeHead {}

export type BindingLikeNodeB<S extends NodeStage = NodeStage> =
  | BindingNodeB<S>
  | InNodeStage<Surface0 | Surface1R, S, EquationNodeB<S>>
export type BindingLikeNode<S extends NodeStage = NodeStage> = BindingLikeNodeB<S> & NodeHead

export interface SigDeclNodeB {
  ty: 'sigDecl'
  ids: IdNode[]
  sig: TypeSchemeNode
}
export interface SigDeclNode extends SigDeclNodeB, NodeHead {}

export interface FixityDeclNodeB {
  ty: 'fixityDecl'
  fixity: Fixity
  ids: IdNode[]
}
export interface FixityDeclNode extends FixityDeclNodeB, NodeHead {}

export type BindingHostRole = 'normal' | 'class' | 'instance'
export interface BindingHostNodeB<S extends NodeStage = NodeStage> {
  ty: 'bindingHost'
  role: BindingHostRole
  sigDecls: SigDeclNode[]
  fixityDecls: FixityDeclNode[]
  bindings: BindingLikeNode<S>[]
}
export interface BindingHostNode<S extends NodeStage = NodeStage> extends BindingHostNodeB<S>, NodeHead {}

export interface DataApplyConNodeB {
  ty: 'dataApplyCon'
  func: IdNode
  params: TypeNode[]
}
export interface DataApplyConNode extends DataApplyConNodeB, NodeHead {}

export interface DataInfixConNodeB {
  ty: 'dataInfixCon'
  lhs: TypeNode
  op: IdNode
  rhs: TypeNode
}
export interface DataInfixConNode extends DataInfixConNodeB, NodeHead {}

export type DataConNodeB<S extends NodeStage = NodeStage> =
  | DataApplyConNodeB
  | InNodeStage<Surface0, S, DataInfixConNodeB>
export type DataConNode<S extends NodeStage = NodeStage> = DataConNodeB<S> & NodeHead

export interface DataDefNodeB<S extends NodeStage = NodeStage> {
  ty: 'dataDef'
  id: IdNode
  params: TypeNode<VarType>[]
  cons: DataConNode<S>[]
}
export interface DataDefNode<S extends NodeStage = NodeStage> extends DataDefNodeB<S>, NodeHead {}

export interface RecordDefFieldNodeB {
  ty: 'recordDefField'
  key: IdNode
  type: TypeNode
}
export interface RecordDefFieldNode extends RecordDefFieldNodeB, NodeHead {}

export interface RecordDefNodeB {
  ty: 'recordDef'
  id: IdNode
  params: TypeNode<VarType>[]
  fields: RecordDefFieldNode[]
}
export interface RecordDefNode extends RecordDefNodeB, NodeHead {}

export interface ClassDefNodeB<S extends NodeStage = NodeStage> {
  ty: 'classDef'
  id: IdNode
  param: TypeNode<VarType>
  bindingHost: BindingHostNode<S>
}
export interface ClassDefNode<S extends NodeStage = NodeStage> extends ClassDefNodeB<S>, NodeHead {}

export interface InstanceDefNodeB<S extends NodeStage = NodeStage> {
  ty: 'instanceDef'
  classId: IdNode
  arg: TypeNode
  bindingHost: BindingHostNode<S>
}
export interface InstanceDefNode<S extends NodeStage = NodeStage> extends InstanceDefNodeB<S>, NodeHead {}

export interface ImportItemNodeB {
  ty: 'importItem'
  id: IdNode
  qid: IdNode | null
}
export interface ImportItemNode extends ImportItemNodeB, NodeHead {}

export interface ImportNodeB {
  ty: 'import'
  modId: IdNode
  isOpen: boolean
  qid: IdNode | null
  items: ImportItemNode[] | null
}
export interface ImportNode extends ImportNodeB, NodeHead {}

export interface ModB<S extends NodeStage = NodeStage> {
  ty: 'mod'
  imports: ImportNode[]
  dataDefs: DataDefNode<S>[]
  recordDefs: RecordDefNode[]
  classDefs: ClassDefNode<S>[]
  instanceDefs: InstanceDefNode<S>[]
  bindingHost: BindingHostNode<S>
}
export interface Mod<S extends NodeStage = NodeStage> extends ModB<S>, NodeHead {}

// Node metas

export const NodeMetaMap: {
  [K in NodeTy]: NodeMeta<K>
} = {
  num: {},
  unit: {},
  char: {},
  str: {},
  var: {
    id: 'node',
  },
  applyMulti: {
    func: 'node',
    args: 'node[]',
  },
  apply: {
    func: 'node',
    arg: 'node',
  },
  infix: {
    args: 'node[]',
    ops: 'node[]',
  },
  sectionL: {
    arg: 'node',
    op: 'node',
  },
  sectionR: {
    arg: 'node',
    op: 'node',
  },
  roll: {
    times: 'node?',
    sides: 'node',
  },
  paren: {
    expr: 'node',
  },
  tuple: {
    elems: 'node[]',
  },
  list: {
    elems: 'node[]',
  },
  recordBindingField: {
    key: 'node',
    val: 'node',
  },
  recordPunningField: {
    key: 'node',
  },
  record: {
    con: 'node',
    fields: 'node[]',
  },
  recordUpdatePunningMatchingField: {
    key: 'node',
    body: 'node',
  },
  recordUpdatePipeField: {
    key: 'node',
    func: 'node',
  },
  recordUpdateMatchingField: {
    key: 'node',
    pat: 'node',
    body: 'node',
  },
  recordUpdate: {
    con: 'node',
    fields: 'node[]',
  },
  varRef: {
    id: 'node',
  },
  wildcardPat: {},
  numPat: {},
  unitPat: {},
  dataPat: {
    con: 'node',
    args: 'node[]',
  },
  infixPat: {
    ops: 'node[]',
    args: 'node[]',
  },
  varPat: {
    id: 'node',
  },
  tuplePat: {
    elems: 'node[]',
  },
  listPat: {
    elems: 'node[]',
  },
  recordPatRebindingField: {
    key: 'node',
    pat: 'node',
  },
  recordPatPunningField: {
    key: 'node',
  },
  recordPat: {
    con: 'node',
    fields: 'node[]',
  },
  let: {
    bindingHost: 'node',
    body: 'node',
  },
  cond: {
    cond: 'node',
    yes: 'node',
    no: 'node',
  },
  caseBranch: {
    pat: 'node',
    body: 'node',
  },
  case: {
    scrutinee: 'node',
    branches: 'node[]',
  },
  ann: {
    expr: 'node',
    ann: 'node',
  },
  lambdaMulti: {
    params: 'node[]',
    body: 'node',
  },
  lambdaCase: {
    branches: 'node[]',
  },
  lambda: {
    param: 'node',
    body: 'node',
  },
  id: {},
  type: {},
  typeScheme: {},
  binding: {
    pat: 'node',
    body: 'node',
  },
  equationApplyFlattenHead: {
    func: 'node',
    params: 'node[]',
  },
  equationApplyHead: {
    func: 'node',
    params: 'node[]',
  },
  equationInfixHead: {
    lhs: 'node',
    op: 'node',
    rhs: 'node',
  },
  equation: {
    head: 'node',
    body: 'node',
  },
  sigDecl: {
    sig: 'node',
    ids: 'node[]',
  },
  fixityDecl: {
    ids: 'node[]',
  },
  bindingHost: {
    sigDecls: 'node[]',
    fixityDecls: 'node[]',
    bindings: 'node[]',
  },
  dataApplyCon: {
    func: 'node',
    params: 'node[]',
  },
  dataInfixCon: {
    lhs: 'node',
    op: 'node',
    rhs: 'node',
  },
  dataDef: {
    id: 'node',
    params: 'node[]',
    cons: 'node[]',
  },
  recordDefField: {
    key: 'node',
    type: 'node',
  },
  recordDef: {
    id: 'node',
    params: 'node[]',
    fields: 'node[]',
  },
  classDef: {
    id: 'node',
    param: 'node',
    bindingHost: 'node',
  },
  instanceDef: {
    classId: 'node',
    arg: 'node',
    bindingHost: 'node',
  },
  importItem: {
    id: 'node',
    qid: 'node?',
  },
  import: {
    modId: 'node',
    items: 'node[]?',
    qid: 'node?',
  },
  mod: {
    imports: 'node[]',
    dataDefs: 'node[]',
    recordDefs: 'node[]',
    classDefs: 'node[]',
    instanceDefs: 'node[]',
    bindingHost: 'node',
  },
}

// Node union

export type ExprB<S extends NodeStage = NodeStage> =
  | NumExprB
  | UnitExprB
  | CharExprB
  | StrExprB
  | VarExprB<S>
  | InNodeStage<Surface0, S, ApplyMultiExprB<S>>
  | InNodeStage<Surface1R | Core, S, ApplyExprB<S>>
  | InNodeStage<Surface0 | Surface1R, S, InfixExprB<S>>
  | InNodeStage<Surface0 | Surface1R, S, SectionLExprB<S>>
  | InNodeStage<Surface0 | Surface1R, S, SectionRExprB<S>>
  | InNodeStage<Surface0, S, RollExprB<S>>
  | InNodeStage<Surface0, S, ParenExprB<S>>
  | InNodeStage<Surface0, S, TupleExprB<S>>
  | InNodeStage<Surface0, S, ListExprB<S>>
  | RecordExprB<S>
  | InNodeStage<Surface0 | Surface1R, S, RecordUpdateExprB<S>>
  | LetExprB<S>
  | CondExprB<S>
  | CaseExprB<S>
  | AnnExprB<S>
  | InNodeStage<Surface0 | Surface1R, S, LambdaMultiExprB<S>>
  | InNodeStage<Surface0, S, LambdaCaseExprB<S>>
  | InNodeStage<Surface1R | Core, S, LambdaExprB<S>>
export type Expr<S extends NodeStage = NodeStage> = ExprB<S> & NodeHead

export type PatB<S extends NodeStage = NodeStage> =
  | WildcardPatB
  | NumPatB
  | InNodeStage<Surface0, S, UnitPatB>
  | InNodeStage<Surface0 | Surface1R, S, InfixPatB<S>>
  | DataPatB<S>
  | VarPatB<S>
  | InNodeStage<Surface0, S, TuplePatB<S>>
  | InNodeStage<Surface0, S, ListPatB<S>>
  | RecordPatB<S>
export type Pat<S extends NodeStage = NodeStage> = PatB<S> & NodeHead

export type NodeB<S extends NodeStage = NodeStage> =
  | ExprB<S>
  | PatB<S>
  | IdNodeB
  | VarRefNodeB<S>
  | InNodeStage<Surface0 | Surface1R, S, EquationHeadNodeB<S>>
  | BindingLikeNodeB<S>
  | SigDeclNodeB
  | BindingHostNodeB<S>
  | CaseBranchNodeB<S>
  | TypeNodeB
  | TypeSchemeNodeB
  | SigDeclNodeB
  | FixityDeclNodeB
  | DataConNodeB
  | DataDefNodeB
  | RecordFieldNodeB<S>
  | RecordUpdateFieldNodeB<S>
  | RecordPatFieldNodeB<S>
  | RecordDefFieldNodeB
  | RecordDefNodeB
  | ImportItemNodeB
  | ImportNodeB
  | ClassDefNodeB<S>
  | InstanceDefNodeB<S>
  | Mod<S>
export type Node<S extends NodeStage = NodeStage> = NodeB<S> & NodeHead

export type NodeTy<S extends NodeStage = NodeStage> = S extends NodeStage ? NodeB<S>['ty'] : never
export type ExprTy<S extends NodeStage = NodeStage> = S extends NodeStage ? ExprB<S>['ty'] : never

export type NodeOfTy<S extends NodeStage, K extends NodeTy = NodeTy<S>> = {
  [Ki in K]: Extract<Node<S>, { ty: Ki }>
}[K]

// Basic methods

export namespace Node {

  export const is = <const Ks extends NodeTy[]>(node: Node, tys: Ks): node is NodeOfTy<NodeStage, Ks[number]> =>
    tys.includes(node.ty)

  export const show: Show<Node> = (): string => {
    throw new Error('showNode not implemented yet')
  }

  export const checkParen = (self: Node, parent: Node | null): boolean => (
    !! parent && (
      parent.ty === 'apply' && (
        is(self, ['lambda', 'lambdaMulti', 'lambdaCase']) ||
        is(self, ['apply', 'applyMulti']) && self === parent.arg
      ) ||
      parent.ty === 'applyMulti' && (
        is(self, ['lambda', 'lambdaMulti', 'lambdaCase', 'applyMulti'])
      ) ||
      self.ty === 'equationInfixHead' && parent.ty === 'equationApplyHead' ||
      self.ty === 'dataPat' && self.args.length > 0 ||
      self.ty === 'infixPat'
    ) ||
    self.ty === 'var' && (
      self.id.style === 'sym' && (! parent || ! is(parent, ['infix', 'sectionL', 'sectionR']))
    ) ||
    self.ty === 'varPat' && (
      self.id.style === 'sym'
    ) ||
    self.ty === 'varRef' && (
      self.id.style === 'sym' && (! parent || ! is(parent, ['infixPat', 'equationInfixHead']))
    ) ||
    self.ty === 'id' && (
      self.style === 'sym' && (! parent || ! is(parent, ['var', 'varPat', 'varRef', 'fixityDecl', 'dataInfixCon']))
    ) ||
    self.ty === 'sectionL' || self.ty === 'sectionR'
  )
}
