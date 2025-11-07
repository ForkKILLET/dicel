import { Range } from 'parsecond'

import { isLower, isUpper, isSymComma } from '@/lex'
import { Bound } from '@/utils/decorators'

import { ApplyExpr, Expr, Pat, VarExpr, NodeB, NodeHead, ApplyExprB, IdNode, LambdaExpr, VarPat, VarRefNode } from './node'
import { Core, NodeStage, PostR, PreR, Surface1, Surface1R } from './stage'
import { AstIdState, NodeMap } from './astId'
import { SymId } from '@/sym'
import { pipe } from '@/utils/compose'

export type NodeMaker =
  <T extends NodeB>(nodePre: T) => T & NodeHead

export namespace NodeMaker {
  export const of = (ais: AstIdState, nodeMap: NodeMap): NodeMaker =>
    nodePre => {
      const astId = ais.next()
      const node = {
        ...nodePre,
        astId,
        range: Range.empty(),
      }
      nodeMap.set(astId, node)
      return node
    }

  export const fake = (): NodeMaker =>
    nodePre => ({
      ...nodePre,
      astId: 0,
      range: Range.empty(),
    })
}

export class NodeFactory {
  static {
    Bound(NodeFactory)
  }

  constructor(public readonly make: NodeMaker) {}

  makeId(id: string): IdNode {
    return this.make({
      ty: 'id',
      id,
      style: pipe(
        id[0] === '!' ? id.slice(1) : id,
        id => (
          isUpper(id[0]) ? 'big' :
          isLower(id[0]) || id[0] === '_' ? 'small' :
          isSymComma(id) ? 'sym' :
          'other'
        ),
      ),
    })
  }

  makeTupleIdN(n: number): IdNode {
    return this.make({
      ty: 'id',
      id: ','.repeat(n - 1),
      style: 'sym',
    })
  }

  makeApplyMulti<S extends NodeStage>(args: Expr<S>[]): Expr<S> {
    return args.reduce(
      (func, arg) => this.make<ApplyExprB<S>>({ ty: 'apply', func, arg }),
    )
  }

  makeAutoTuple<S extends PreR>(elems: Expr<S>[]): Expr<S>
  makeAutoTuple<S extends PostR>(elems: Expr<S>[], withSymbol: true): Expr<S>
  makeAutoTuple(elems: Expr[], withSymbol?: true): Expr {
    const { length } = elems
    if (length === 0) return this.make({ ty: 'unit' })
    if (length === 1) return elems[0]
    const tupleId = this.makeTupleIdN(length)
    const tuple = this.makeApplyMulti([
      withSymbol
        ? this.makeVar(tupleId, `Builtin:${tupleId.id}`)
        : this.makeVar(tupleId),
      ...elems,
    ])
    return tuple
  }

  makeLambdaMulti<S extends Surface1R | Core>(params: Pat<S>[], body: Expr<S>): LambdaExpr<S> {
    return params.reduceRight(
      (bodyAcc, param) => this.make({
        ty: 'lambda',
        param,
        body: bodyAcc,
      }),
      body,
    ) as LambdaExpr<S>
  }

  makeAutoTuplePat<S extends PreR>(elems: Pat<S>[]): Pat<S>
  makeAutoTuplePat<S extends PostR>(elems: Pat<S>[], resolved: true): Pat<S>
  makeAutoTuplePat(elems: Pat[], withSymbol?: true): Pat {
    const { length } = elems
    if (length === 0) return this.make({ ty: 'unitPat' })
    if (length === 1) return elems[0]
    const tupleId = this.makeTupleIdN(length)
    const tuplePat = this.make({
      ty: 'dataPat',
      con: withSymbol
        ? this.makeVarRef(tupleId, `Builtin:${tupleId.id}`)
        : this.makeVarRef(tupleId),
      args: elems,
    })
    return tuplePat
  }

  private liftId(id: string | IdNode): IdNode {
    return typeof id === 'string' ? this.makeId(id) : id
  }

  makeVar<S extends PreR>(id: string | IdNode): VarExpr<S>
  makeVar<S extends PostR>(id: string | IdNode, symId: SymId): VarExpr<S>
  makeVar(id: string | IdNode, symId?: SymId): VarExpr {
    return this.make({
      ty: 'var',
      id: this.liftId(id),
      symId,
    })
  }

  makeVarPat<S extends PreR>(id: string | IdNode): VarPat<S>
  makeVarPat<S extends PostR>(id: string | IdNode, symId: SymId): VarPat<S>
  makeVarPat(id: string | IdNode, symId?: SymId): VarPat {
    return this.make({
      ty: 'varPat',
      id: this.liftId(id),
      symId,
    })
  }

  makeVarRef<S extends PreR>(id: string | IdNode): VarRefNode<S>
  makeVarRef<S extends PostR>(id: string | IdNode, symId: SymId): VarRefNode<S>
  makeVarRef(id: string | IdNode, symId?: SymId): VarRefNode {
    return this.make({
      ty: 'varRef',
      id: this.liftId(id),
      symId,
    })
  }
}

export const fakeNodeFactory = new NodeFactory(NodeMaker.fake())

export const extractApplyExpr = (expr: ApplyExpr<Surface1>): Expr<Surface1>[] => expr.func.ty === 'apply'
  ? [...extractApplyExpr(expr.func), expr.arg]
  : [expr.func, expr.arg]
