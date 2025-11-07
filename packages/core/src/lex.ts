export const RESERVED_WORDS = [
  'let', 'in', 'if', 'then', 'else', 'case', 'of',
  'data', 'record', 'class', 'instance', 'where',
  'infix', 'infixl', 'infixr',
  'import',
]
export const RESERVED_SYMS = [
  '::', '=', '->', '|', '.', '=>'
]

export const SYM_CHARS = '+-*/^%<>=!~&|.$#?:'
export const isSym = (str: string) => [...str].every(ch => SYM_CHARS.includes(ch))
export const isComma = (str: string) => [...str].every(ch => ch === ',')
export const isSymComma = (str: string) => isSym(str) || isComma(str)
export const isUpper = (char: string) => char >= 'A' && char <= 'Z'
export const isLower = (char: string) => char >= 'a' && char <= 'z'
