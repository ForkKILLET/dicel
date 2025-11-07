import { Ctor, Func } from '@/utils/types'

export const Bound = (target: Ctor) => {
  for (const key of Reflect.ownKeys(target.prototype)) {
    if (key === 'constructor') continue
    const descriptor = Reflect.getOwnPropertyDescriptor(target.prototype, key)
    if (descriptor && typeof descriptor.value === 'function') {
      let func: Func = descriptor?.value
      Object.defineProperty(target.prototype, key, {
        configurable: true,
        get() {
          const funcBound = func.bind(this)
          Object.defineProperty(this, key, {
            configurable: true,
            get() {
              return funcBound
            },
            set(newFunc) {
              func = newFunc
              delete this[key]
            },
          })
          return funcBound
        },
        set(newFunc) {
          func = newFunc
        },
      })
    }
  }
}
