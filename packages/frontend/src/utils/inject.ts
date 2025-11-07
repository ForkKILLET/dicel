import type { ModStateMap, ModOutputs, Pass } from '@dicel/core'
import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { NodeSelection } from './nodeSelection'

export const kModStates = Symbol('modStates') as InjectionKey<ModStateMap>
export const kNodeSelection = Symbol('nodeSelection') as InjectionKey<NodeSelection>
export const kModOutputs = Symbol('outputs') as InjectionKey<ComputedRef<ModOutputs<Pass>>>

export const kTypeShowPrettyIds = Symbol('typeShowPrettyIds') as InjectionKey<Ref<boolean>>
export const kTypeSchemeImplicit = Symbol('typeSchemeImplicit') as InjectionKey<Ref<boolean>>
