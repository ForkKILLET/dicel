export const RESERVE_WORDS = [
  'let', 'in', 'case', 'of', 'data', 'class', 'where', 'infix', 'infixl', 'infixr'
]

export const SYMBOL_CHARS = '+-*/^%<>=!~&|.$#'
export const isSymbol = (str: string) => [...str].every(ch => SYMBOL_CHARS.includes(ch))
export const isSymbolOrComma = (str: string) => isSymbol(str) || [...str].every(ch => ch === ',')
export const isUpper = (char: string) => char >= 'A' && char <= 'Z'
export const isLower = (char: string) => char >= 'a' && char <= 'z'
