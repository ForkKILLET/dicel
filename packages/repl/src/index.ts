import { createInterface } from 'node:readline/promises'
import { inspect } from 'node:util'

import { parseExpr, execute, check, TypeScheme, Value, desugar, Node, builtinFixityDict, resolve, builtinMods } from '@dicel/core'

export const startRepl = () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'dicel> ',
  })


  const processLine = (line: string) => {
    const parseRes = parseExpr(line)
    if (parseRes.isErr) {
      console.log(`Parse Error: %o`, parseRes.err)
      return
    }

    const expr = parseRes.val

    if (process.env.DEBUG) console.log('AST:', expr)
    console.log('Expr: %s', Node.show(expr))

    const resolveRes = resolve({ compiledMods: builtinMods }, expr)
    if (resolveRes.isErr) {
      console.log('Resolve Error: %o', resolveRes.err)
      return
    }
    const exprRes = resolveRes.val

    const desugarRes = desugar({ fixityDict: builtinFixityDict }, exprRes)
    if (desugarRes.isErr) {
      console.log('Desugar Error: %o', desugarRes.err)
      return
    }
    const exprDes = desugarRes.val

    const checkOutput = check(exprDes)
    if (checkOutput.isErr) {
      console.log('Check Error:', checkOutput.err)
      return
    }

    const { typeScheme } = checkOutput.val
    console.log('Type: %s', TypeScheme.show(typeScheme))

    const executeResult = execute(exprDes)
    if (executeResult.isErr) {
      console.log('Runtime Error:', executeResult.err)
      return
    }
    const { val } = executeResult
    console.log('Value:', Value.show(val))
    if (process.env.DEBUG) console.log('Raw Value:', inspect(val, { depth: null }))
  }

  console.log('Welcome to Dicel REPL!')
  rl.prompt()

  if (process.env.DEBUG) {
    inspect.defaultOptions.depth = null
  }

  rl.on('line', line => {
    processLine(line)
    console.log()
    rl.prompt()
  })

  rl.on('close', () => {
    console.log('\nExiting REPL.')
    process.exit(0)
  })

  rl.on('SIGINT', () => {
    if (rl.line) {
      rl.write(null, { ctrl: true, name: 'e' })
      rl.write(null, { ctrl: true, name: 'u' })
    }
    else {
      console.log('\nPress Ctrl+D to exit.')
    }
    rl.prompt()
  })
}

startRepl()
