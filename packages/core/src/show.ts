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

export const describeToShow = <T, D>(
  describe: (input: T) => D,
  show: (desc: D, show: (desc: D) => string) => string,
  needsParen: (self: D, parent: D | null) => boolean,
) => {
  const _show = (parent: D | null) => (self: D) => {
    const text = show(self, _show(self))
    return needsParen(self, parent) ? `(${text})` : text
  }
  return (input: T) => _show(null)(describe(input))
}
