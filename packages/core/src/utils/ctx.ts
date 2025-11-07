export type Ctx<Data extends object, Impl extends object> = Data & Impl & {
  fork: (override: Partial<Data>) => Ctx<Data, Impl>
}

export const defineCtx = <Data extends object, Impl extends object>(impl: (ctx: Ctx<Data, Impl>) => Impl) => {
  type C = Ctx<Data, Impl>
  const create = (data: Data): C => {
    const ctx = { ...data } as C
    ctx.fork = (override: Partial<Data>) => create({
      ...ctx,
      ...override,
    })
    Object.assign(ctx, impl(ctx))
    return ctx
  }
  return create
}
