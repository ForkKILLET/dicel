import { createInterface } from 'node:readline/promises'
import { inspect } from 'node:util'

import { parse, explain, Locale, execute, Dice, check, showTypeScheme } from '@dicel/core'

export const startRepl = () => {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'dicel> ',
  })

  const locale: Locale = process.env.DICEL_LOCALE as Locale || 'dicel'

  const processLine = (line: string) => {
    const parseRes = parse(line)
    if (parseRes.isErr) {
      console.log(`Parse Error: %o`, parseRes.val)
      return
    }

    const ast = parseRes.val.val

    if (process.env.DEBUG) console.log('AST:', ast)
    const explanation = explain(ast, locale)
    console.log('Explain: %s', explanation)

    const checkOutput = check(ast)
    if (checkOutput.isErr) {
      console.log('Check Error:', checkOutput.val)
      return
    }

    console.log('Type: %s', showTypeScheme(checkOutput.val))
    try {
      const result = execute(ast)
      console.log('Result:', result)
      if (result instanceof Dice) {
        console.log('Dice rolled:', result.roll())
      }
    }
    catch (err) {
      console.log(`Runtime Error: %s`, err instanceof Error ? err.message : err)
    }
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