export const Surface0 = 'S0'
export const Surface1 = 'S1'
export const SurfaceR = 'SR'
export const Core     = 'C'

export type Surface0  = typeof Surface0
export type Surface1  = typeof Surface1
export type SurfaceR  = typeof SurfaceR
export type Core      = typeof Core

export type Surface1R = Surface1 | SurfaceR
export type PreR      = Surface0 | Surface1
export type PostR     = SurfaceR | Core

export type NodeStage = PreR | PostR
