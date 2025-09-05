import type { Expr, Ops } from './parse'
import { showType } from './types'

export type Locale = 'zh' | 'dicel'

export const explain = (expr: Expr, locale: Locale): string =>
  explainTable[locale](expr)

export const opTable: Record<Locale, Record<Ops, string>> = {
  dicel: {
    '||': '||',
    '&&': '&&',
    '==': '==',
    '!=': '!=',
    '<': '<',
    '>': '>',
    '<=': '<=',
    '>=': '>=',
    '+': '+',
    '-': '-',
    '*': '*',
    '/': '/',
    '%': '%',
    '.': '.',
    '$': '$',
  },
  zh: {
    '||': '或',
    '&&': '且',
    '==': '等于',
    '!=': '不等于',
    '<': '小于',
    '>': '大于',
    '<=': '小于等于',
    '>=': '大于等于',
    '+': '加',
    '-': '减',
    '*': '乘',
    '/': '除',
    '%': '模',
    '.': '复合',
    '$': '应用',
  },
}

const isWestern = (char: string): boolean => /[\w()]/.test(char)
const isPunctuation = (char: string): boolean => /[,.;、，：。]/.test(char)
const isStartParen = (char: string): boolean => /[(]/.test(char)
const isEndParen = (char: string): boolean => /[)]/.test(char)
const needsSpace = (str1: string, str2: string): boolean => {
  if (! str1 || ! str2) return false
  const end = str1.at(- 1)!
  const start = str2[0]
  return (
    ! isPunctuation(end) && ! isPunctuation(start) &&
    ! isEndParen(start) && ! isStartParen(end) &&
    isWestern(end) !== isWestern(start)
  )
}

const pangu = (strs: TemplateStringsArray, ...vals: string[]): string =>
  strs.reduce((res, str, i) => {
    let val = i ? vals[i - 1] : ''
    if (needsSpace(res, val)) val = ' ' + val
    if (needsSpace(val, str)) val = val + ' '
    return res + val + str
  }, '')

export const explainDicel = (expr: Expr): string => {
  switch (expr.type) {
    case 'num':
      return String(expr.val)
    case 'unit':
      return '()'
    case 'var':
      return expr.id
    case 'cond':
      return `(${explainDicel(expr.cond)} ? ${explainDicel(expr.yes)} : ${explainDicel(expr.no)})`
    case 'let':
      return `let ${explainDicel(expr.binding.lhs)} = ${explainDicel(expr.binding.rhs)} in ${explainDicel(expr.body)}`
    case 'lambda':
      return `(\\${expr.param.id} -> ${explainDicel(expr.body)})`
    case 'apply':
      if (expr.func.type === 'apply' && expr.func.func.type === 'varOp') {
        return `(${explainDicel(expr.func.arg)} ${opTable.dicel[expr.func.func.id]} ${explainDicel(expr.arg)})`
      }
      return `(${explainDicel(expr.func)} ${explainDicel(expr.arg)})`
    case 'varOp':
      return `(${opTable.dicel[expr.id]})`
    case 'var':
      return expr.id
    case 'ann':
      return `(${explainDicel(expr.expr)} :: ${showType(expr.ann.val)})`
  }
}

export const explainZh = (expr: Expr): string => {
  switch (expr.type) {
    case 'num':
      return String(expr.val)
    case 'unit':
      return '()'
    case 'var':
      return expr.id
    case 'cond':
      return pangu`(如果${explainZh(expr.cond)}，那么${explainZh(expr.yes)}，否则${explainZh(expr.no)})`
    case 'let':
      return pangu`取${explainZh(expr.binding.lhs)}为${explainZh(expr.binding.rhs)}时 (${explainZh(expr.body)}) 的值)`
    case 'lambda':
      return pangu`接收参数${explainZh(expr.param)}返回${explainZh(expr.body)}的函数`
    case 'apply':
      return pangu`(以参数${explainZh(expr.arg)}调用${explainZh(expr.func)}的结果)`
    case 'var':
      return expr.id
    case 'varOp':
      return pangu`操作符 (${expr.id})`
    case 'ann':
      return explainZh(expr.expr)
  }
}

export const explainTable: Record<Locale, (expr: Expr) => string> = {
  zh: explainZh,
  dicel: explainDicel,
}