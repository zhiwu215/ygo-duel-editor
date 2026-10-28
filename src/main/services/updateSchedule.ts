import type { UpdateState } from '@shared/index'

export interface UpdateScheduleConfig {
  readonly intervalMs: number
  readonly maxBackoffMs: number
  readonly jitter: number
}

export const DEFAULT_UPDATE_SCHEDULE_CONFIG: UpdateScheduleConfig = {
  intervalMs: 600_000,
  maxBackoffMs: 3_600_000,
  jitter: 0.2
}

const MIN_DURATION_MS = 1_000
const MAX_DURATION_MS = 2_147_483_647

function resolveDurationMs(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const value = Number(env[name] ?? fallback)
  if (!Number.isSafeInteger(value) || value < MIN_DURATION_MS || value > MAX_DURATION_MS) {
    throw new Error(`${name} must be an integer from ${MIN_DURATION_MS} through ${MAX_DURATION_MS}`)
  }
  return value
}

export function resolveUpdateScheduleConfig(env: NodeJS.ProcessEnv): UpdateScheduleConfig {
  const intervalMs = resolveDurationMs(
    env,
    'YGO_DUEL_EDITOR_UPDATE_CHECK_INTERVAL_MS',
    DEFAULT_UPDATE_SCHEDULE_CONFIG.intervalMs
  )
  const maxBackoffMs = resolveDurationMs(
    env,
    'YGO_DUEL_EDITOR_UPDATE_CHECK_MAX_BACKOFF_MS',
    Math.max(intervalMs, DEFAULT_UPDATE_SCHEDULE_CONFIG.maxBackoffMs)
  )
  const jitter = Number(
    env.YGO_DUEL_EDITOR_UPDATE_CHECK_JITTER ?? DEFAULT_UPDATE_SCHEDULE_CONFIG.jitter
  )
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1 || maxBackoffMs < intervalMs) {
    throw new Error(
      'update schedule requires jitter in [0, 1] and max backoff covering the interval'
    )
  }
  return { intervalMs, maxBackoffMs, jitter }
}

export interface UpdateChecker {
  readonly currentState: UpdateState
  check(manual?: boolean): Promise<UpdateState>
}

export class UpdateSchedule {
  private timer: ReturnType<typeof setTimeout> | undefined
  private pending: Promise<UpdateState> | undefined
  private activeChecks = 0
  private disposed = false
  private nextCheck = -Infinity
  private delay: number

  constructor(
    private readonly updates: UpdateChecker,
    private readonly config: UpdateScheduleConfig,
    private readonly random: () => number = Math.random,
    private readonly now: () => number = () => performance.now()
  ) {
    this.delay = config.intervalMs
  }

  async check(manual = false, force = manual): Promise<UpdateState> {
    if (this.disposed) throw new Error('update schedule is disposed')
    if (this.pending !== undefined && !manual) return this.pending
    if (!force && this.now() < this.nextCheck) return this.updates.currentState
    clearTimeout(this.timer)
    this.timer = undefined
    this.activeChecks += 1
    this.pending = Promise.resolve()
      .then(() => {
        if (this.disposed) throw new Error('update schedule is disposed')
        return this.updates.check(manual)
      })
      .then(
        (state) => {
          this.complete(state.phase === 'error' && state.failedOperation === 'check')
          return state
        },
        (error: unknown) => {
          this.complete(true)
          throw error
        }
      )
    return this.pending
  }

  dispose(): void {
    this.disposed = true
    clearTimeout(this.timer)
    this.timer = undefined
  }

  private complete(failed: boolean): void {
    if (--this.activeChecks !== 0) return
    this.pending = undefined
    this.schedule(failed)
  }

  private schedule(failed: boolean): void {
    if (this.disposed) return
    const { intervalMs, maxBackoffMs, jitter } = this.config
    this.delay = failed ? Math.min(maxBackoffMs, this.delay * 2) : intervalMs
    const lower = Math.max(MIN_DURATION_MS, this.delay * (1 - jitter))
    const upper = Math.min(maxBackoffMs, this.delay * (1 + jitter))
    const delay = Math.round(lower + (upper - lower) * this.random())
    this.nextCheck = this.now() + delay
    this.timer = setTimeout(() => {
      void this.check(false, true).catch((error: unknown) => {
        console.error('[update] scheduled check failed:', error)
      })
    }, delay)
  }
}
