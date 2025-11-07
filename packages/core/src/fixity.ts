import { Map } from '@/utils/data'
import { Show } from '@/utils/types'

export type Assoc = 'left' | 'right' | 'none'
export type Fixity = {
  prec: number
  assoc: Assoc
}

export type FixityMap = Map<string, Fixity>

export namespace Fixity {
  export const of = (prec: number, assoc: Assoc): Fixity => ({
    prec,
    assoc,
  })

  export const def = () => of(9, 'left')

  export const show: Show<Fixity> = ({ assoc, prec }) =>
    `infix${assoc === 'none' ? '' : assoc[0]} ${prec}`
}

export const BUILTIN_FIXITY_MAP: Map<string, Fixity> = Map.ofDict({
  '<<': Fixity.of(9, 'right'),
  '>>': Fixity.of(9, 'right'),
  '^':  Fixity.of(8, 'right'),
  '*':  Fixity.of(7, 'left'),
  '/':  Fixity.of(7, 'left'),
  '%':  Fixity.of(7, 'left'),
  '+':  Fixity.of(6, 'left'),
  '-':  Fixity.of(6, 'left'),
  '++': Fixity.of(5, 'right'),
  ':':  Fixity.of(5, 'right'),
  '==': Fixity.of(4, 'none'),
  '!=': Fixity.of(4, 'none'),
  '<':  Fixity.of(4, 'none'),
  '<=': Fixity.of(4, 'none'),
  '>':  Fixity.of(4, 'none'),
  '>=': Fixity.of(4, 'none'),
  '&&': Fixity.of(3, 'right'),
  '||': Fixity.of(2, 'right'),
  '|>': Fixity.of(1, 'left'),
  '$':  Fixity.of(0, 'right'),
})
