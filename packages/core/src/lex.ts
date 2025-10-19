export const RESERVED_WORDS = [
  'let', 'in', 'case', 'of', 'data', 'class', 'instance', 'where', 'infix', 'infixl', 'infixr', 'import',
]
export const RESERVED_SYMBOLS = [
  '?', ':', '::', '=', '->', '|,'
]

export const SYMBOL_CHARS = '+-*/^%<>=!~&|.$#?:'
export const isSymbol = (str: string) => [...str].every(ch => SYMBOL_CHARS.includes(ch))
export const isSymbolOrComma = (str: string) => isSymbol(str) || [...str].every(ch => ch === ',')
export const isUpper = (char: string) => char >= 'A' && char <= 'Z'
export const isLower = (char: string) => char >= 'a' && char <= 'z'

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

export const builtinFixityDict: FixityTable = {
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

export const showStr = (str: string, quote: '"' | '\''): string => {
  const escaped = [...str]
    .map(ch => {
      if (ch === quote || ch === '\\') return '\\' + ch
      if (ch === '\n') return '\\n'
      if (ch === '\r') return '\\r'
      if (ch === '\t') return '\\t'
      const pt = ch.codePointAt(0)!
      if (pt < 32 || pt > 126) return `\\u${pt.toString(16).padStart(4, '0')}`
      return ch
    })
    .join('')
  return quote + escaped + quote
}
