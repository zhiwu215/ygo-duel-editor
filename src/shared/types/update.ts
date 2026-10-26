export type UpdatePhase =
  'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error'

export interface UpdateProgress {
  percent: number
  transferred: number
  total: number
  bytesPerSecond: number
}

export interface UpdateState {
  phase: UpdatePhase
  supported: boolean
  currentVersion: string
  availableVersion?: string
  releaseNotes?: string
  progress?: UpdateProgress
  error?: string
}
