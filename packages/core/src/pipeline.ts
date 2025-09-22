import { Result } from 'fk-result'
import { ParseErr } from 'parsecond'
import { CheckMod, checkMod } from './check'
import { parseMod } from './parse'
import { executeMod, ValueEnv } from './execute'
import { TypeEnv } from './infer'
import { Value } from './values'
import { Mod, toInternal } from './nodes'

export namespace Run {
  export const enum Pass {
    Parse = 0,
    Check = 1,
    Execute = 2,
    Finish = 100,
  }

  export type Err =
    | { pass: Pass.Parse, err: ParseErr | null }
    | { pass: Pass.Check, err: CheckMod.Err, mod: Mod, modInt: Mod<{}, 'int'> }
    | { pass: Pass.Execute, err: Error, mod: Mod, modInt: Mod<{}, 'int'>, env: TypeEnv }

  export type Ok = {
    pass: Pass.Finish
    mod: Mod
    modInt: Mod<{}, 'int'>
    env: TypeEnv
    runtimeEnv: ValueEnv
    mainValue: Value
    mainValueStr: string
  }

  export type Union = Err | Ok
}

export class Pipeline {
  private res: Run.Union | null = null

  run(source: string) {
    return this.res = Result
      .wrap<Run.Ok, Run.Err>(() => {
        const mod = parseMod(source)
          .mapErr<Run.Err>(err => ({ pass: Run.Pass.Parse, err }))
          .unwrap()

        const modInt = toInternal(mod)

        const { env } = checkMod(modInt, { isMain: true })
          .mapErr<Run.Err>(err => ({ pass: Run.Pass.Check, err, mod, modInt }))
          .unwrap()

        const runtimeEnv = executeMod(modInt)
          .mapErr<Run.Err>(err => ({ pass: Run.Pass.Execute, err, mod, modInt, env }))
          .unwrap()
        const mainValue = runtimeEnv['main'].value
        const mainValueStr = Value.show(mainValue)

        return { pass: Run.Pass.Finish, mod, modInt, env, runtimeEnv, mainValue, mainValueStr }
      })
      .match(
        ok => ok,
        err => err,
      )
  }

  reExecute() {
    if (! this.res) return
    if (this.res.pass <= Run.Pass.Check) return


  }
}
