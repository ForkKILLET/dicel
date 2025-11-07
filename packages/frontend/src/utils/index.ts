import type { Ref, UnwrapRef } from 'vue'

export const withRef = <RT extends Ref, U>(ref: RT, consumer: (value: UnwrapRef<RT>) => U): U =>
  consumer(ref.value)

export const withRefs = <const RTs extends Ref[], U>(
  refs: RTs,
  consumer: (...values: { [I in keyof RTs]: UnwrapRef<RTs[I]> }) => U
): U => consumer(...refs.map(ref => ref.value) as { [I in keyof RTs]: UnwrapRef<RTs[I]> })
