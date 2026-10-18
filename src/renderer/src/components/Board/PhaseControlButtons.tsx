import React from 'react'
import { DuelPhase } from '@shared/index'
import { useDuelStore } from '../../stores/useDuelStore'
import { useDuelEngineStore } from '../../stores/useDuelEngineStore'
import { cn } from '../../lib/utils'

const PHASE_LABELS: Record<DuelPhase, string> = {
  DP: 'D P',
  SP: 'S P',
  M1: 'M 1',
  BP: 'B P',
  M2: 'M 2',
  EP: 'E P'
}

export const PhaseStatusButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  return (
    <div
      className={cn(
        'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest',
        'border-neutral-400/80 dark:border-neutral-600 bg-neutral-300/90 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 shadow-inner'
      )}
    >
      {PHASE_LABELS[currentPhase] || currentPhase}
    </div>
  )
}

export const PhaseMiddleButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const setCurrentPhase = useDuelStore((s) => s.setCurrentPhase)
  const activeTurnPlayer = useDuelStore((s) => s.activeTurnPlayer)
  const executeDrawCard = useDuelStore((s) => s.executeDrawCard)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  // R2：阶段入口由引擎请求数据决定（合法才显示）
  const canBp = pendingRequest !== null && pendingRequest.data.kind === 'idle' && pendingRequest.data.canBp
  const canM2 =
    pendingRequest !== null && pendingRequest.data.kind === 'battle' && pendingRequest.data.canM2

  if (currentPhase === 'DP') {
    if (isEngine) return null
    return (
      <button
        type="button"
        onClick={() => executeDrawCard(activeTurnPlayer)}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
          'border-sky-400/80 dark:border-sky-500/80 bg-sky-100/90 dark:bg-sky-950/60 hover:bg-sky-200 dark:hover:bg-sky-900/80 text-sky-900 dark:text-sky-200 shadow-xs'
        )}
      >
        抽卡
      </button>
    )
  }

  if (currentPhase === 'M1') {
    if (isEngine && !canBp) return null
    return (
      <button
        type="button"
        onClick={() => {
          if (isEngine && canBp) {
            void useDuelEngineStore.getState().submitAnswer({ kind: 'idle', cmd: 'TO_BP' })
          } else setCurrentPhase('BP')
        }}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        B P
      </button>
    )
  }

  if (currentPhase === 'BP') {
    if (isEngine && !canM2) return null
    return (
      <button
        type="button"
        onClick={() => {
          if (isEngine && canM2) {
            void useDuelEngineStore.getState().submitAnswer({ kind: 'battle', cmd: 'TO_M2' })
          } else setCurrentPhase('M2')
        }}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        M 2
      </button>
    )
  }

  return null
}

export const PhaseEpButton: React.FC = () => {
  const currentPhase = useDuelStore((s) => s.currentPhase)
  const setCurrentPhase = useDuelStore((s) => s.setCurrentPhase)
  const nextTurn = useDuelStore((s) => s.nextTurn)
  const isEngine = useDuelEngineStore((s) => s.isInitialized)
  const pendingRequest = useDuelEngineStore((s) => s.pendingRequest)
  const canEp =
    pendingRequest !== null &&
    ((pendingRequest.data.kind === 'idle' && pendingRequest.data.canEp) ||
      (pendingRequest.data.kind === 'battle' && pendingRequest.data.canEp))

  if (currentPhase === 'DP' || currentPhase === 'SP') {
    if (isEngine) return null
    return (
      <button
        type="button"
        onClick={() => setCurrentPhase('M1')}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        M 1
      </button>
    )
  }

  if (currentPhase === 'M1' || currentPhase === 'BP' || currentPhase === 'M2') {
    if (isEngine && !canEp) return null
    return (
      <button
        type="button"
        onClick={() => {
          if (isEngine && canEp) {
            void useDuelEngineStore
              .getState()
              .submitAnswer(
                pendingRequest?.kind === 'battle'
                  ? { kind: 'battle', cmd: 'TO_EP' }
                  : { kind: 'idle', cmd: 'TO_EP' }
              )
          } else setCurrentPhase('EP')
        }}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-mono text-[11px] font-bold tracking-widest cursor-pointer transition-colors',
          'border-neutral-400 dark:border-neutral-500 bg-neutral-200/95 dark:bg-neutral-700/95 hover:bg-neutral-100 dark:hover:bg-neutral-600 active:bg-neutral-300 text-neutral-900 dark:text-neutral-100 shadow-xs'
        )}
      >
        E P
      </button>
    )
  }

  if (currentPhase === 'EP') {
    if (isEngine) return null
    return (
      <button
        type="button"
        onClick={() => nextTurn()}
        className={cn(
          'w-[54px] h-[22px] rounded-xs border select-none flex items-center justify-center font-sans text-[10px] font-bold tracking-tight cursor-pointer transition-colors',
          'border-amber-400/80 dark:border-amber-500/80 bg-amber-100/90 dark:bg-amber-950/60 hover:bg-amber-200 dark:hover:bg-amber-900/80 text-amber-900 dark:text-amber-200 shadow-xs'
        )}
      >
        下回合
      </button>
    )
  }

  return null
}
