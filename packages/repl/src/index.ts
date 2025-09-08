import { createInterface } from 'node:readline/promises'
import { inspect } from 'node:util'

import { parse, explain, Locale, execute, Dice, check, showTypeScheme, showValue } from '@dicel/core'

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
      console.log(`Parse Error: %o`, parseRes.err)
      return
    }

    const expr = parseRes.val.val

    if (process.env.DEBUG) console.log('AST:', expr)
    const explanation = explain(expr, locale)
    console.log('Explain: %s', explanation)

    const checkOutput = check(expr)
    if (checkOutput.isErr) {
      console.log('Check Error:', checkOutput.err)
      return
    }

    const { typeScheme } = checkOutput.val
    console.log('Type: %s', showTypeScheme(typeScheme))

    const result = execute(expr)
    if (result.isErr) {
      console.log('Runtime Error:', result.err)
      return
    }
    const { val } = result
    console.log('Value:', showValue(val))
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