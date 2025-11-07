export class VarState {
  constructor(public readonly prefix: string) {}

  protected counter = 0

  protected nextId() {
    return `${this.prefix}${this.counter ++}`
  }
}
