import type { EngineTimelineNode } from '@shared/index'
import { useDuelStore } from '../useDuelStore'

export interface LpSequenceStep {
  player: 0 | 1
  lp: number
  delta: number
}

const STEP_MS = 420
const SETTLE_MS = 520

let timers: ReturnType<typeof setTimeout>[] = []

export function lpSequenceSteps(node: EngineTimelineNode | null | undefined): LpSequenceStep[] {
  const steps: LpSequenceStep[] = []
  for (const event of node?.logEvents ?? []) {
    if (event.kind === 'damage') {
      steps.push({ player: event.player, lp: event.lp, delta: -event.value })
    } else if (event.kind === 'recover') {
      steps.push({ player: event.player, lp: event.lp, delta: event.value })
    } else if (event.kind === 'lp-update' && event.delta !== 0) {
      steps.push({ player: event.player, lp: event.lp, delta: event.delta })
    }
  }
  return steps
}

export function cancelLpSequence(): void {
  for (const timer of timers) clearTimeout(timer)
  timers = []
  const store = useDuelStore.getState()
  store.setLpDisplay(0, null)
  store.setLpDisplay(1, null)
}

export function playLpSequence(
  steps: LpSequenceStep[],
  previousLp: [number, number],
  onComplete?: () => void
): boolean {
  if (steps.length < 2) return false
  cancelLpSequence()
  const store = useDuelStore.getState()
  store.setLpDisplay(0, previousLp[0])
  store.setLpDisplay(1, previousLp[1])
  steps.forEach((step, index) => {
    timers.push(
      setTimeout(
        () => {
          const current = useDuelStore.getState()
          current.setLpDisplay(step.player, step.lp)
          current.flashLp(step.player, step.delta)
        },
        (index + 1) * STEP_MS
      )
    )
  })
  timers.push(
    setTimeout(
      () => {
        const current = useDuelStore.getState()
        current.setLpDisplay(0, null)
        current.setLpDisplay(1, null)
        onComplete?.()
      },
      steps.length * STEP_MS + SETTLE_MS
    )
  )
  return true
}
